import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'editor@knitting.example.com' })
  @IsEmail()
  declare email: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  declare name: string;

  @ApiProperty({ enum: ['editor', 'reviewer', 'admin'] })
  @IsIn(['editor', 'reviewer', 'admin'])
  declare role: string;

  @ApiProperty({ example: 'securepassword' })
  @IsString()
  @MinLength(8)
  declare password: string;
}
