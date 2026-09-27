import { emptyWeek, type PlanDay } from '@coachdesk/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { WeekEditor, type WeekErrors } from '../components/WeekEditor';

/** The editor with real state, exposing the latest week for assertions. */
function Harness({ errors, onWeek }: { errors?: WeekErrors; onWeek: (days: PlanDay[]) => void }) {
  const [days, setDays] = useState<PlanDay[]>(emptyWeek());
  return (
    <WeekEditor
      days={days}
      errors={errors}
      onChange={(next) => {
        setDays(next);
        onWeek(next);
      }}
    />
  );
}

describe('WeekEditor', () => {
  it('adds a workout with an exercise and a meal to the selected day', async () => {
    const user = userEvent.setup();
    let week: PlanDay[] = [];
    render(<Harness onWeek={(d) => (week = d)} />);

    await user.click(screen.getByRole('tab', { name: /Wed/ }));
    expect(screen.getByRole('heading', { name: 'Wednesday' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add a workout' }));
    await user.type(screen.getByLabelText('Workout title'), 'Legs');
    await user.type(screen.getByLabelText('Exercise 1'), 'Squat');
    await user.click(screen.getByRole('button', { name: '+ Add meal' }));
    await user.type(screen.getByLabelText('Meal 1'), 'Lunch');

    expect(week[2].workout).toMatchObject({ title: 'Legs', exercises: [{ name: 'Squat', sets: 3, reps: '10' }] });
    expect(week[2].meals).toMatchObject([{ name: 'Lunch' }]);
    expect(week[0]).toEqual({ workout: null, meals: [] });
    expect(screen.getByRole('tab', { name: /Wed/ })).toHaveTextContent('Workout · 1');
  });

  it('copies a day to all other days with new item ids', async () => {
    const user = userEvent.setup();
    let week: PlanDay[] = [];
    render(<Harness onWeek={(d) => (week = d)} />);

    await user.click(screen.getByRole('button', { name: '+ Add meal' }));
    await user.type(screen.getByLabelText('Meal 1'), 'Oats');
    await user.selectOptions(screen.getByLabelText('Copy this day to'), 'all');
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(week.every((d) => d.meals[0]?.name === 'Oats')).toBe(true);
    const ids = week.map((d) => d.meals[0].id);
    expect(new Set(ids).size).toBe(7);
  });

  it('moves between days with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness onWeek={() => undefined} />);
    await user.click(screen.getByRole('tab', { name: /Mon/ }));
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Sun/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Sun/ })).toHaveFocus();
  });

  it('shows errors on the field and marks the day tab', async () => {
    render(<Harness onWeek={() => undefined} errors={{ '4.meals.0.name': 'Enter the meal' }} />);
    expect(screen.getByRole('tab', { name: /Fri/ })).toHaveTextContent('(has errors)');
    expect(screen.getByRole('tab', { name: /Mon/ })).not.toHaveTextContent('(has errors)');
  });
});
