import type { AssistanceFeedback, Question, Testimony } from '../entities.ts'
import type { Queryable } from '../store/pgStore.ts'
import { calendarDate, isoInstant, TableRepository } from './tableRepository.ts'

/** Testemunhos: `date` é o dia do envio (AAAA-MM-DD); membro, curso e aula podem ficar null. */
export const createTestimonyRepository = (exec: Queryable) =>
  new TableRepository<Testimony>(exec, {
    table: 'testimonies',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'userId', column: 'user_id' },
      { key: 'name', column: 'name' },
      { key: 'text', column: 'text' },
      { key: 'courseId', column: 'course_id' },
      { key: 'lessonId', column: 'lesson_id' },
      { key: 'source', column: 'source' },
      { key: 'status', column: 'status' },
      { key: 'date', column: 'date', read: calendarDate('t.date') },
    ],
  })

/** Dúvidas dos membros; apagar a conta apaga as dúvidas. */
export const createQuestionRepository = (exec: Queryable) =>
  new TableRepository<Question>(exec, {
    table: 'questions',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'userId', column: 'user_id' },
      { key: 'name', column: 'name' },
      { key: 'email', column: 'email' },
      { key: 'subject', column: 'subject' },
      { key: 'body', column: 'body' },
      { key: 'courseId', column: 'course_id' },
      { key: 'lessonId', column: 'lesson_id' },
      { key: 'courseTitle', column: 'course_title' },
      { key: 'lessonTitle', column: 'lesson_title' },
      { key: 'answer', column: 'answer' },
      { key: 'status', column: 'status' },
      { key: 'createdAt', column: 'created_at', read: isoInstant('t.created_at') },
      { key: 'answeredAt', column: 'answered_at', read: isoInstant('t.answered_at') },
    ],
  })

/** Feedback sobre a assistência (plano de 500 MT); tabela `assistance_feedback`. */
export const createFeedbackRepository = (exec: Queryable) =>
  new TableRepository<AssistanceFeedback>(exec, {
    table: 'assistance_feedback',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'userId', column: 'user_id' },
      { key: 'name', column: 'name' },
      { key: 'rating', column: 'rating' },
      { key: 'comment', column: 'comment' },
      { key: 'createdAt', column: 'created_at', read: isoInstant('t.created_at') },
    ],
  })
