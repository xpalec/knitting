import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEntryRelationshipDto } from './dto/create-entry-relationship.dto';
import { UpdateEntryRelationshipDto } from './dto/update-entry-relationship.dto';

@Injectable()
export class AdminEntryRelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // listRelationships — all relationships where this entry is the source
  // ---------------------------------------------------------------------------

  async listRelationships(sourceEntryId: string) {
    const relationships = await this.prisma.entryRelationship.findMany({
      where: { source_entry_id: sourceEntryId },
      include: {
        target_entry: {
          include: {
            translations: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return relationships;
  }

  // ---------------------------------------------------------------------------
  // createRelationship — validate self-link, create, catch P2002 as 409
  // ---------------------------------------------------------------------------

  async createRelationship(dto: CreateEntryRelationshipDto) {
    if (dto.sourceEntryId === dto.targetEntryId) {
      throw new BadRequestException(
        'An entry cannot have a relationship with itself.',
      );
    }

    try {
      const relationship = await this.prisma.entryRelationship.create({
        data: {
          source_entry_id: dto.sourceEntryId,
          target_entry_id: dto.targetEntryId,
          type: dto.type,
          note: dto.note ?? null,
        },
        include: {
          target_entry: {
            include: {
              translations: true,
            },
          },
        },
      });

      return relationship;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A relationship of this type between these two entries already exists.`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // updateRelationship — patch type and/or note, catch P2025 as 404, P2002 as 409
  // ---------------------------------------------------------------------------

  async updateRelationship(id: string, dto: UpdateEntryRelationshipDto) {
    try {
      const relationship = await this.prisma.entryRelationship.update({
        where: { id },
        data: {
          ...(dto.type !== undefined && { type: dto.type }),
          // Empty string clears the note; undefined leaves it unchanged
          ...(dto.note !== undefined && { note: dto.note.trim() || null }),
        },
        include: {
          target_entry: {
            include: { translations: true },
          },
        },
      });
      return relationship;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Entry relationship '${id}' not found.`);
        }
        if (err.code === 'P2002') {
          throw new ConflictException(
            'A relationship of this type between these two entries already exists.',
          );
        }
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // deleteRelationship — delete by ID, catch P2025 (record not found) as 404
  // ---------------------------------------------------------------------------

  async deleteRelationship(id: string) {
    try {
      await this.prisma.entryRelationship.delete({
        where: { id },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Entry relationship '${id}' not found.`,
        );
      }
      throw err;
    }
  }
}
