import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(
    @Request() req: any,
    @Query('q') q = '',
    @Query('limit') limit = '5',
  ) {
    return this.searchService.search(req.user.businessId, q, Number(limit));
  }
}
