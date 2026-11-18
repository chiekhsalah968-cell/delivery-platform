import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  listWilayas() {
    return this.prisma.wilaya.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, nameAr: true, nameFr: true },
    });
  }

  async listMunicipalities(wilayaCode: number) {
    const wilaya = await this.prisma.wilaya.findUnique({ where: { code: wilayaCode } });
    if (!wilaya) throw new NotFoundException('Wilaya not found');
    return this.prisma.municipality.findMany({
      where: { wilayaCode },
      orderBy: { nameFr: 'asc' },
      select: { id: true, nameAr: true, nameFr: true, postalCode: true },
    });
  }
}