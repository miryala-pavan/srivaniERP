"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const business_module_1 = require("./business/business.module");
const products_module_1 = require("./products/products.module");
const suppliers_module_1 = require("./suppliers/suppliers.module");
const customers_module_1 = require("./customers/customers.module");
const pos_module_1 = require("./pos/pos.module");
const grn_module_1 = require("./grn/grn.module");
const inventory_module_1 = require("./inventory/inventory.module");
const reports_module_1 = require("./reports/reports.module");
const expenses_module_1 = require("./expenses/expenses.module");
const settings_module_1 = require("./settings/settings.module");
const admin_module_1 = require("./admin/admin.module");
const notifications_module_1 = require("./notifications/notifications.module");
const day_closure_module_1 = require("./day-closure/day-closure.module");
const users_module_1 = require("./users/users.module");
const departments_module_1 = require("./departments/departments.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [app_controller_1.AppController],
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            business_module_1.BusinessModule,
            products_module_1.ProductsModule,
            departments_module_1.DepartmentsModule,
            suppliers_module_1.SuppliersModule,
            customers_module_1.CustomersModule,
            pos_module_1.PosModule,
            grn_module_1.GrnModule,
            inventory_module_1.InventoryModule,
            reports_module_1.ReportsModule,
            expenses_module_1.ExpensesModule,
            settings_module_1.SettingsModule,
            admin_module_1.AdminModule,
            notifications_module_1.NotificationsModule,
            day_closure_module_1.DayClosureModule,
            users_module_1.UsersModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map