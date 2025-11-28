defineHandler({
    onEnter(log, args, state) {
        log('ccaes_cbc_encrypt_mode() [libcorecrypto.dylib]');

        try {
            const bt = Thread.backtrace(
                this.context,
                Backtracer.ACCURATE
            )
                .map(DebugSymbol.fromAddress)
                .join('\n');

            log('--- Call Stack ---\n' + bt + '\n-------------------');
        } catch (e) {
            log('Error printing backtrace: ' + e);
        }
    },

    onLeave(log, retval, state) {
    }
});
