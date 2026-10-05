import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export interface Image {
  contenu: Buffer;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Reconnaît le format réel d'une image à ses premiers octets (pas à son nom). */
export function typeImage(contenu: Buffer): Image['type'] | null {
  if (contenu.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (
    contenu
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    contenu.subarray(0, 4).toString('latin1') === 'RIFF' &&
    contenu.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Stockage des fichiers (photos). Version locale : un dossier sur disque
 * (STOCKAGE_DIR). Un stockage compatible S3 pourra la remplacer en production.
 */
@Injectable()
export class StockageService {
  private readonly racine: string;

  constructor(config: ConfigService) {
    this.racine = resolve(config.get<string>('STOCKAGE_DIR', 'stockage'));
  }

  /** Vérifie qu'il s'agit bien d'une image JPEG, PNG ou WebP. */
  verifierImage(contenu: Buffer): Image['type'] {
    const type = typeImage(contenu);
    if (!type) {
      throw new BadRequestException(
        'La photo doit être une image JPEG, PNG ou WebP.',
      );
    }
    return type;
  }

  async enregistrer(cle: string, contenu: Buffer): Promise<void> {
    const chemin = this.chemin(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, contenu);
  }

  async lire(cle: string): Promise<Buffer | null> {
    try {
      return await readFile(this.chemin(cle));
    } catch {
      return null;
    }
  }

  async supprimer(cle: string): Promise<void> {
    await rm(this.chemin(cle), { force: true });
  }

  /** Chemin sur disque ; refuse toute clé qui sortirait du dossier de stockage. */
  private chemin(cle: string): string {
    const chemin = resolve(join(this.racine, cle));
    if (!chemin.startsWith(this.racine + sep)) {
      throw new BadRequestException('Clé de stockage invalide.');
    }
    return chemin;
  }
}
