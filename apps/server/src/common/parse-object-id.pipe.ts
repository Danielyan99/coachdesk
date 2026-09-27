import { NotFoundException, type PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Turns a route id into an ObjectId. A malformed id is "not found" (404), the same answer
 * as an id that belongs to someone else, so the API never hints which ids exist.
 */
export class ParseObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!/^[a-f\d]{24}$/i.test(value)) throw new NotFoundException();
    return new Types.ObjectId(value);
  }
}
