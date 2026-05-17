import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { PosModule } from './pos/pos.module';
import { GrnModule } from './grn/grn.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DayClosureModule } from './day-closure/day-closure.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BusinessModule,
    ProductsModule,
    DepartmentsModule,
    SuppliersModule,
    CustomersModule,
    PosModule,
    GrnModule,
    InventoryModule,
    ReportsModule,
    ExpensesModule,
    SettingsModule,
    AdminModule,
    NotificationsModule,
    DayClosureModule,
    UsersModule,
  ],
})
export class AppModule {}
