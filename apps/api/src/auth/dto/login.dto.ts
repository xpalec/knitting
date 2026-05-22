import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'editor@knitting.example.com' })
  @IsEmail()
  declare email: string;

  @ApiProperty({ example: 'secret' })
  @IsString()
  @MinLength(6)
  declare password: string;
}
