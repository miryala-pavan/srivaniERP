import { Module } from '@nestjs/common';
import { ReportsService }        from './reports.service';
import { ReportsController }     from './reports.controller';
import { GstReportsService }     from './gst-reports.service';
import { ExcelExportService }    from './excel-export.service';
import { GstReportsController }  from './gst-reports.controller';

@Module({
  providers:   [ReportsService, GstReportsService, ExcelExportService],
  controllers: [ReportsController, GstReportsController],
})
export class ReportsModule {}
