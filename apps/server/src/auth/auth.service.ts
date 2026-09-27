import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { LoginInput, SignupInput } from '@coachdesk/shared';
import { Model, mongo } from 'mongoose';
import { User } from '../users/user.schema';
import { hashPassword, verifyPassword } from './password';
import { type RequestUser, toRequestUser } from './request-user';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
  ) {}

  async signupTrainer(input: SignupInput): Promise<RequestUser> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.users.create({ ...input, passwordHash, role: 'trainer', tier: 'starter' });
      return toRequestUser(user.toObject());
    } catch (err) {
      if (err instanceof mongo.MongoServerError && err.code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  async login({ email, password }: LoginInput): Promise<RequestUser> {
    const user = await this.users.findOne({ email }).lean();
    const ok = await verifyPassword(user?.passwordHash, password);
    // Same message for unknown email and wrong password: don't reveal which emails exist.
    if (!ok || !user) throw new UnauthorizedException('Email or password is incorrect');
    return toRequestUser(user);
  }

  signToken(user: RequestUser): Promise<string> {
    return this.jwt.signAsync({ sub: user.id });
  }
}
