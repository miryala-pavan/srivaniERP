import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Platform Core modules (Phase 0)
import { HelpModule } from './platform/help/help.module';
import { ClockModule } from './platform/clock/clock.module';
import { AuditModule } from './platform/audit/audit.module';
import { PlatformEventsModule } from './platform/events/events.module';
import { RuleEngineModule } from './platform/rule-engine/rule-engine.module';
import { DocumentsModule } from './platform/documents/documents.module';
import { PlatformNotificationsModule } from './platform/notifications/notifications.module';
import { AiModule } from './platform/ai/ai.module';
import { LedgerModule } from './platform/ledger/ledger.module';
import { NumberSeriesModule } from './platform/number-series/number-series.module';
import { BusinessConfigModule } from './platform/config/business-config.module';
import { ComputationModule } from './platform/computation/computation.module';
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
import { ServiceablePincodesModule } from './serviceable-pincodes/serviceable-pincodes.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DayClosureModule } from './day-closure/day-closure.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { EventsModule } from './events/events.module';
import { SearchModule } from './search/search.module';
import { ShopModule } from './shop/shop.module';
import { ShopCacheModule } from './shop/shop-cache.module';
import { BankModule } from './bank/bank.module';
import { FinancialYearModule } from './financial-year/financial-year.module';
import { OnlineOrdersModule } from './online-orders/online-orders.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';
import { AddressesModule } from './addresses/addresses.module';
import { StorefrontProfileModule } from './storefront-profile/storefront-profile.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ListsModule } from './lists/lists.module';
import { ReviewsModule } from './reviews/reviews.module';
import { GoogleContactsModule } from './google-contacts/google-contacts.module';
import { VolumePricingModule } from './volume-pricing/volume-pricing.module';
import { RepackModule } from './repack/repack.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { GstModule } from './gst/gst.module';
import { TdsModule } from './tds/tds.module';
import { LedgerApiModule } from './ledger/ledger-api.module';
import { HistoryModule } from './history/history.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 300 }]),
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
    ServiceablePincodesModule,
    AdminModule,
    NotificationsModule,
    DayClosureModule,
    UsersModule,
    EventsModule,
    SearchModule,
    ShopCacheModule,
    ShopModule,
    BankModule,
    FinancialYearModule,
    OnlineOrdersModule,
    StockAlertsModule,
    AddressesModule,
    StorefrontProfileModule,
    AuditLogModule,
    ListsModule,
    GoogleContactsModule,
    ReviewsModule,
    VolumePricingModule,
    RepackModule,
    PurchaseOrdersModule,
    GstModule,
    TdsModule,
    LedgerApiModule,
    HistoryModule,

    // Platform Core (Phase 0)
    HelpModule,
    ClockModule,
    AuditModule,
    PlatformEventsModule,
    RuleEngineModule,
    DocumentsModule,
    PlatformNotificationsModule,
    AiModule,
    LedgerModule,
    NumberSeriesModule,
    BusinessConfigModule,
    ComputationModule,
  ],
})
export class AppModule {}
