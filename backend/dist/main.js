"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:4000',
            process.env.FRONTEND_URL || 'http://localhost:4000',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 Srivani ERP API running on: http://localhost:${port}/api`);
    console.log(`❤️  Health check: http://localhost:${port}/api/health`);
}
bootstrap();
//# sourceMappingURL=main.js.map