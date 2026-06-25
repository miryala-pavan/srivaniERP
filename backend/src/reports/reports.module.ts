import { Module } from '@nestjs/common';
import { ReportsService }        from './reports.service';
import { ReportsController }     from './reports.controller';
import { GstReportsService }     from './gst-reports.service';
import { ExcelExportService }    from './excel-export.service';
import { CaExportService }       from './ca-export.service';
import { GstReportsController }  from './gst-reports.controller';
import { GstHealthService }      from './gst-health.service';
import { GstHealthController }   from './gst-health.controller';
import { NotificationsModule }   from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  providers:   [ReportsService, GstReportsService, ExcelExportService, CaExportService, GstHealthService],
  controllers: [ReportsController, GstReportsController, GstHealthController],
})
export class ReportsModule {}
