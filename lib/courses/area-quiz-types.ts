/** The daily mastery quiz for one Area of Study — always multiple-choice so a 100% pass is a clean, deterministic check rather than an AI judgement call. */
export type AreaQuizQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type AreaQuiz = {
  title: string
  questions: AreaQuizQuestion[]
}

/** What the client sees before attempting today's quiz — correctIndex/explanation withheld so the answers can't be read out of the network response. */
export type AreaQuizQuestionPreview = Omit<AreaQuizQuestion, 'correctIndex' | 'explanation'>

export type AreaQuizPreview = {
  title: string
  questions: AreaQuizQuestionPreview[]
}

export function toAreaQuizPreview(quiz: AreaQuiz): AreaQuizPreview {
  return {
    title: quiz.title,
    questions: quiz.questions.map(({ id, question, options }) => ({ id, question, options })),
  }
}
