package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"
	
	"github.com/frida/frida-go/frida"
)

// 全局变量，保持 Frida 脚本对象
var (
	fridaScript *frida.Script
	session     *frida.Session
	taskId      = int64(0x20000000)
)

// SendRequest 请求结构体
type SendRequest struct {
	Message []*Message `json:"message"`
	UserID  string     `json:"user_id"`
}

type Message struct {
	Type string           `json:"type"`
	Data *SendRequestData `json:"data"`
}

type SendRequestData struct {
	Id   string `json:"id"`
	Text string `json:"text"`
}

func initFridaGadget() {
	mgr := frida.NewDeviceManager()
	// 连接到 Gadget 默认端口
	device, err := mgr.AddRemoteDevice("127.0.0.1:27042", frida.NewRemoteDeviceOptions())
	if err != nil {
		fmt.Printf("❌ 无法连接 Gadget: %v\n", err)
		os.Exit(1)
	}
	
	session, err = device.Attach("Gadget", nil)
	if err != nil {
		fmt.Printf("❌ 附加失败: %v\n", err)
		os.Exit(1)
	}
	
	loadJs()
	
}

func initFrida() {
	// 1. 获取本地设备管理器
	mgr := frida.NewDeviceManager()
	
	// 2. 枚举并获取本地设备 (TypeLocal)
	device, err := mgr.DeviceByType(frida.DeviceTypeLocal)
	if err != nil {
		log.Fatalf("无法获取本地设备: %v", err)
	}
	
	fmt.Println("正在尝试 Attach 到微信...")
	session, err = device.Attach(47516, nil)
	if err != nil {
		log.Fatalf("Attach 失败 (请检查 SIP 状态或权限): %v", err)
	}
	
	loadJs()
}

func loadJs() {
	js, _ := os.ReadFile("./script.js")
	script, err := session.CreateScript(string(js))
	if err != nil {
		fmt.Printf("❌ 创建脚本失败: %v\n", err)
		os.Exit(1)
	}
	
	// 打印 JS 里的 console.log
	script.On("message", func(rawMsg string) {
		var msg map[string]interface{}
		json.Unmarshal([]byte(rawMsg), &msg)
		
		msgType := msg["type"].(string)
		
		switch msgType {
		case "send":
			go SendHttpReq(msg)
		case "log":
			// 这里处理 console.log
			fmt.Printf("[JS日志] %s\n", msg["payload"])
		case "error":
			// 这里处理 JS 脚本报错
			fmt.Printf("[❌脚本报错] %s\n", msg["description"])
		}
	})
	
	if err := script.Load(); err != nil {
		fmt.Printf("❌ 加载脚本失败: %v\n", err)
		os.Exit(1)
	}
	
	fridaScript = script
	fmt.Println("✅ Frida 已就绪，微信控制通道已打通")
}

func sendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持 POST", http.StatusMethodNotAllowed)
		return
	}
	
	req := new(SendRequest)
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		http.Error(w, "无效的 JSON", http.StatusBadRequest)
		return
	}
	
	// 参数校验
	if len(req.Message) == 0 || req.UserID == "" {
		http.Error(w, "参数缺失", http.StatusBadRequest)
		return
	}
	
	text := ""
	for _, v := range req.Message {
		if v.Type == "text" {
			text = v.Data.Text
		}
	}
	
	// 调用 Frida RPC
	atomic.AddInt64(&taskId, 1)
	fmt.Printf("📩 收到 HTTP 请求，任务: %d\n", taskId)
	
	// 注意：这里的名称 "manualtrigger" 必须和 JS 侧 rpc.exports 里的键名完全一致
	result := fridaScript.ExportsCall("manualTrigger", taskId, req.UserID, text)
	// 返回结果
	json.NewEncoder(w).Encode(map[string]any{
		"status": result,
	})
}

func main() {
	// 1. 初始化 Frida
	initFrida()
	
	// 2. 注册路由
	http.HandleFunc("/send_private_msg", sendHandler)
	
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	
	// 启动一个 goroutine 处理退出逻辑
	go func() {
		<-stop
		fmt.Println("\n正在释放 Frida 资源并退出...")
		os.Exit(0) // 强制结束进程
	}()
	
	// 3. 启动服务
	port := ":58080"
	fmt.Printf("🌐 HTTP 服务启动在 http://127.0.0.1%s\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		fmt.Printf("❌ 服务启动失败: %v\n", err)
	}
	
}

func SendHttpReq(msg map[string]interface{}) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("panic: %v\n", r)
		}
	}()
	
	time.Sleep(1 * time.Second)
	// 这里处理你的 X1 数据
	jsonData, err := json.Marshal(msg["payload"])
	if err != nil {
		fmt.Printf("JSON 序列化失败: %v\n", err)
		return
	}
	
	fmt.Printf("发送数据: %s\n", string(jsonData))
	
	// 4. 创建 POST 请求
	req, err := http.NewRequest("POST", "http://127.0.0.1:36060/onebot", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("创建请求失败: %v\n", err)
		return
	}
	
	// 5. 设置 Header (OneBot 接口通常要求 application/json)
	h := hmac.New(sha1.New, []byte("MuseBot"))
	h.Write(jsonData)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature", "sha1="+hex.EncodeToString(h.Sum(nil)))
	
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	// 6. 执行请求
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("请求执行失败: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	// 7. 读取返回结果
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("读取响应失败: %v\n", err)
		return
	}
	
	fmt.Printf("状态码: %d 返回内容: %s\n", resp.StatusCode, string(body))
}
