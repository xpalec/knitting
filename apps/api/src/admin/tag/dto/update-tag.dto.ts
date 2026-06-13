// UpdateTagDto is intentionally empty — the Tag entity has no mutable
// language-independent fields after removing type and color_hex.
// Tag updates are done via PUT /tags/:slug/translations/:locale.
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTagDto {}
