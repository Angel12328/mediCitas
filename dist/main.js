// Punto de entrada - mediCitas API
import 'dotenv/config';
import { buildApp } from './app.js';
import { getEnv } from './shared/config/env.js';
const env = getEnv();
const app = buildApp({
    // La documentación no se expone en producción (hardening)
    enableDocs: env.NODE_ENV !== 'production',
});
const start = async () => {
    try {
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
void start();
//# sourceMappingURL=main.js.map