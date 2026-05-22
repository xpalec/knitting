import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserService } from './user.service';

@ApiTags('admin/users')
@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin' as never)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List editorial users' })
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new editorial user' })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user role' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.userService.updateRole(id, dto);
  }
}
