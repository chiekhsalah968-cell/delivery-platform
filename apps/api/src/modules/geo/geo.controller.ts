import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Public()
  @Get('wilayas')
  @ApiOperation({ summary: 'List the 58 Algerian wilayas' })
  listWilayas() {
    return this.geo.listWilayas();
  }

  @Public()
  @Get('wilayas/:code/municipalities')
  @ApiOperation({ summary: 'List municipalities for a wilaya' })
  listMunicipalities(@Param('code', ParseIntPipe) code: number) {
    return this.geo.listMunicipalities(code);
  }
}