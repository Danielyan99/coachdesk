import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Sub-documents shared by Template and ClientPlan. The zod schema in @coachdesk/shared does the real
// validation before anything is saved; these only give MongoDB a clear shape.

@Schema({ _id: false })
class ExerciseDoc {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) sets: number;
  @Prop({ required: true }) reps: string;
  @Prop({ type: Number }) restSec?: number | null;
  @Prop() notes?: string;
}

@Schema({ _id: false })
class MealDoc {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ type: String }) time?: string | null;
  @Prop({ default: '' }) description: string;
  @Prop({ type: Number }) kcal?: number | null;
}

@Schema({ _id: false })
class WorkoutDoc {
  @Prop({ required: true }) title: string;
  @Prop({ type: [SchemaFactory.createForClass(ExerciseDoc)], default: [] }) exercises: ExerciseDoc[];
}

@Schema({ _id: false })
export class PlanDayDoc {
  @Prop({ type: SchemaFactory.createForClass(WorkoutDoc), default: null }) workout: WorkoutDoc | null;
  @Prop({ type: [SchemaFactory.createForClass(MealDoc)], default: [] }) meals: MealDoc[];
}

export const PlanDaySchema = SchemaFactory.createForClass(PlanDayDoc);
