// Student Quiz Taking Screen
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Form, Alert } from "react-bootstrap";
import { useSelector } from "react-redux";
import { RootState } from "../../../../../store";
import * as client from "../../client";

export default function StudentQuizTaking() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.cid as string;
  const quizId = params.qid as string;

  const currentUser = useSelector(
    (state: RootState) => state.accountReducer.currentUser
  ) as { role: string; _id: string } | null;

  const [quiz, setQuiz] = useState<any>({
    title: "",
    description: "",
    points: 0,
    questions: [],
    timeLimit: 20,
    multipleAttempts: false,
    howManyAttempts: 1,
    oneQuestionAtATime: true,
  });

  // string for MCQ/TF, string[] for FIB (in React state only)
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: string | string[];
  }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [currentAttempt, setCurrentAttempt] = useState<any>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [latestAttempt, setLatestAttempt] = useState<any>(null);
  const [viewingPreviousAttempt, setViewingPreviousAttempt] = useState(false);

  const fetchQuiz = async () => {
    if (!quizId) return;
    const data = await client.findQuizById(quizId);
    if (data) {
      setQuiz(data);
    }
  };

  const fetchAttemptData = async () => {
    if (!quizId || !currentUser) return;

    try {
      // Get attempt count
      const countData = await client.getAttemptCount(quizId, currentUser._id);
      setAttemptCount(Math.max(0, countData.count || 0));

      // Get latest attempt
      const latest = await client.findLatestAttempt(quizId, currentUser._id);
      if (latest && latest.isSubmitted) {
        setLatestAttempt(latest);
        setViewingPreviousAttempt(true);
        setIsSubmitted(true);

        // Restore answers into state (parse JSON for FIB if needed)
        const answersMap: { [key: number]: string | string[] } = {};
        if (latest.answers && Array.isArray(latest.answers)) {
          latest.answers.forEach((ans: any) => {
            let value: any = ans.answer;
            if (typeof value === "string" && value.trim().startsWith("[")) {
              try {
                value = JSON.parse(value);
              } catch {
                // leave as string if not valid JSON
              }
            }
            answersMap[ans.questionIndex] = value;
          });
        }
        setSelectedAnswers(answersMap);
        setScore(latest.score || 0);
      }
    } catch (error) {
      console.error("Error fetching attempt data:", error);
      setAttemptCount(0);
    }
  };

  useEffect(() => {
    fetchQuiz();
    fetchAttemptData();
  }, [quizId, currentUser]);

  // MCQ + TF single-answer handler
  const handleAnswerChange = (questionIndex: number, answer: string) => {
    if (isSubmitted || viewingPreviousAttempt) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answer,
    });
    updateSavedTime();
    saveProgress(questionIndex, answer);
  };

  // FIB: multi-blank handler (array in state)
  const handleFibAnswerChange = (
    questionIndex: number,
    blankIndex: number,
    value: string,
    totalBlanks: number
  ) => {
    if (isSubmitted || viewingPreviousAttempt) return;

    const existing = selectedAnswers[questionIndex];
    let arr: string[] = [];

    if (Array.isArray(existing)) {
      arr = [...existing];
    } else {
      arr = Array(totalBlanks).fill("");
    }

    arr[blankIndex] = value;

    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: arr,
    });

    updateSavedTime();
    saveProgress(questionIndex, arr);
  };

  const updateSavedTime = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setLastSavedTime(timeString);
  };

  // IMPORTANT: in DB, always store answer as a string (JSON for FIB)
  const saveProgress = async (
    questionIndex: number,
    answer: string | string[]
  ) => {
    if (!currentUser || viewingPreviousAttempt) return;

    const persistedAnswer = Array.isArray(answer)
      ? JSON.stringify(answer)
      : answer;

    try {
      if (!currentAttempt) {
        const countData = await client.getAttemptCount(quizId, currentUser._id);
        const freshCount = Math.max(0, countData.count || 0);

        const maxAttempts = quiz.multipleAttempts
          ? quiz.howManyAttempts || 1
          : 1;
        if (freshCount >= maxAttempts) {
          alert("You have already used all available attempts for this quiz.");
          setViewingPreviousAttempt(true);
          return;
        }

        const newAttempt = {
          quizId,
          userId: currentUser._id,
          courseId,
          attemptNumber: freshCount + 1,
          answers: [
            { questionIndex, answer: persistedAnswer, isCorrect: false },
          ],
          score: 0,
          totalPoints: quiz.questions.reduce(
            (sum: number, q: any) => sum + (q.points || 0),
            0
          ),
          isSubmitted: false,
        };
        const created = await client.createAttempt(newAttempt);
        setCurrentAttempt(created);
        setAttemptCount(freshCount);
      } else {
        const updatedAnswers = [...(currentAttempt.answers || [])];
        const existingIndex = updatedAnswers.findIndex(
          (a: any) => a.questionIndex === questionIndex
        );

        if (existingIndex >= 0) {
          updatedAnswers[existingIndex] = {
            questionIndex,
            answer: persistedAnswer,
            isCorrect: false,
          };
        } else {
          updatedAnswers.push({
            questionIndex,
            answer: persistedAnswer,
            isCorrect: false,
          });
        }

        await client.updateAttempt(currentAttempt._id, {
          answers: updatedAnswers,
        });
        setCurrentAttempt({ ...currentAttempt, answers: updatedAnswers });
      }
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  };

  // Scoring: FIB uses arrays in state; answers we return use strings for DB
  const calculateScore = () => {
    let totalScore = 0;
    const answersWithCorrectness: any[] = [];

    quiz.questions.forEach((question: any, index: number) => {
      const userAnswer = selectedAnswers[index];

      // Unanswered
      if (
        userAnswer === undefined ||
        userAnswer === null ||
        (Array.isArray(userAnswer) &&
          userAnswer.every((a) => !a || a.toString().trim() === ""))
      ) {
        answersWithCorrectness.push({
          questionIndex: index,
          answer: "",
          isCorrect: false,
        });
        return;
      }

      // FIB: compare arrays, then store JSON string
      if (question.type === "FIB") {
        const correctAnswers: string[] =
          question.answers && question.answers.length > 0
            ? question.answers
            : question.correctAnswer
            ? [question.correctAnswer]
            : [];

        if (!Array.isArray(userAnswer) || correctAnswers.length === 0) {
          answersWithCorrectness.push({
            questionIndex: index,
            answer: Array.isArray(userAnswer)
              ? JSON.stringify(userAnswer)
              : userAnswer,
            isCorrect: false,
          });
          return;
        }

        const normalizedCorrect = correctAnswers.map((a: string) =>
          a?.toString().trim().toLowerCase()
        );
        const normalizedUser = userAnswer.map((a: string) =>
          (a || "").toString().trim().toLowerCase()
        );

        const allMatch = normalizedCorrect.every(
          (ans, i) => (normalizedUser[i] || "") === ans
        );

        if (allMatch) {
          totalScore += question.points || 0;
        }

        answersWithCorrectness.push({
          questionIndex: index,
          answer: JSON.stringify(userAnswer),
          isCorrect: allMatch,
        });
        return;
      }

      // MCQ / TF (single string)
      const correctAnswer = question.correctAnswer
        ?.toString()
        .trim()
        .toLowerCase();
      const providedAnswer = userAnswer.toString().trim().toLowerCase();
      const isCorrect = !!correctAnswer && correctAnswer === providedAnswer;

      if (isCorrect) {
        totalScore += question.points || 0;
      }

      answersWithCorrectness.push({
        questionIndex: index,
        answer: userAnswer,
        isCorrect,
      });
    });

    return { score: totalScore, answers: answersWithCorrectness };
  };

  const handleSubmit = async () => {
    if (!currentUser) return;

    try {
      const { score: calculatedScore, answers } = calculateScore();
      setScore(calculatedScore);
      setIsSubmitted(true);

      if (currentAttempt) {
        await client.updateAttempt(currentAttempt._id, {
          answers,
          score: calculatedScore,
          submittedAt: new Date(),
          isSubmitted: true,
        });
      } else {
        const countData = await client.getAttemptCount(quizId, currentUser._id);
        const freshCount = Math.max(0, countData.count || 0);

        const totalPoints = quiz.questions.reduce(
          (sum: number, q: any) => sum + (q.points || 0),
          0
        );
        await client.createAttempt({
          quizId,
          userId: currentUser._id,
          courseId,
          attemptNumber: freshCount + 1,
          answers,
          score: calculatedScore,
          totalPoints,
          submittedAt: new Date(),
          isSubmitted: true,
        });
      }

      await fetchAttemptData();
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz. Please try again.");
      setIsSubmitted(false);
    }
  };

  const handleBack = () => {
    router.push(`/Courses/${courseId}/Quizzes/${quizId}`);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      updateSavedTime();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      updateSavedTime();
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    updateSavedTime();
  };

  const handleStartNewAttempt = async () => {
    if (!quizId || !currentUser) return;

    try {
      const countData = await client.getAttemptCount(quizId, currentUser._id);
      const freshAttemptCount = Math.max(0, countData.count || 0);

      const maxAttempts = quiz.multipleAttempts ? quiz.howManyAttempts || 1 : 1;
      if (freshAttemptCount >= maxAttempts) {
        alert("You have already used all available attempts for this quiz.");
        return;
      }

      setAttemptCount(freshAttemptCount);
      setViewingPreviousAttempt(false);
      setIsSubmitted(false);
      setSelectedAnswers({});
      setCurrentAttempt(null);
      setScore(0);
      setCurrentQuestionIndex(0);
    } catch (error) {
      console.error("Error starting new attempt:", error);
      alert("Failed to start new attempt. Please try again.");
    }
  };

  const isAnswerCorrect = (questionIndex: number) => {
    const question = quiz.questions[questionIndex];
    const userAnswer = selectedAnswers[questionIndex];

    if (!question) return false;

    if (question.type === "FIB") {
      const correctAnswers: string[] =
        question.answers && question.answers.length > 0
          ? question.answers
          : question.correctAnswer
          ? [question.correctAnswer]
          : [];

      if (!Array.isArray(userAnswer) || correctAnswers.length === 0)
        return false;

      const normalizedCorrect = correctAnswers.map((a: string) =>
        a?.toString().trim().toLowerCase()
      );
      const normalizedUser = userAnswer.map((a: string) =>
        (a || "").toString().trim().toLowerCase()
      );

      return normalizedCorrect.every(
        (ans, i) => (normalizedUser[i] || "") === ans
      );
    }

    if (!userAnswer || !question.correctAnswer) return false;

    const correctAnswer = question.correctAnswer
      .toString()
      .trim()
      .toLowerCase();
    const providedAnswer = userAnswer.toString().trim().toLowerCase();

    return correctAnswer === providedAnswer;
  };

  if (!currentUser) return null;

  if (currentUser.role === "FACULTY") {
    router.push(`/Courses/${courseId}/Quizzes/${quizId}/Preview`);
    return null;
  }

  const totalPoints = quiz.questions.reduce(
    (sum: number, q: any) => sum + (q.points || 0),
    0
  );

  const canTakeQuiz =
    !quiz.multipleAttempts || attemptCount < (quiz.howManyAttempts || 1);

  const attemptsRemaining = Math.max(
    0,
    quiz.multipleAttempts
      ? (quiz.howManyAttempts || 1) - attemptCount
      : 1 - attemptCount
  );

  return (
    <div className="p-3">
      {/* Top Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3>{quiz.title}</h3>
          {isSubmitted && (
            <div className="mt-2">
              <Alert
                variant={score === totalPoints ? "success" : "info"}
                className="mb-0 py-2"
              >
                <strong>
                  Quiz Score: {score} / {totalPoints} points
                </strong>
              </Alert>
            </div>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={handleBack}>
            Back to Details
          </Button>
        </div>
      </div>

      {/* Viewing Previous Attempt Alert */}
      {viewingPreviousAttempt && (
        <Alert variant="info" className="mb-3">
          ⓘ You are viewing your previous attempt (Attempt #
          {latestAttempt?.attemptNumber})
          {canTakeQuiz && (
            <div className="mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartNewAttempt}
              >
                Start New Attempt ({attemptsRemaining} remaining)
              </Button>
            </div>
          )}
          {!canTakeQuiz && (
            <div className="mt-2 text-muted">
              You have used all available attempts for this quiz.
            </div>
          )}
        </Alert>
      )}

      {/* Cannot Take Quiz - No Attempts Remaining */}
      {!viewingPreviousAttempt && !isSubmitted && !canTakeQuiz && (
        <Alert variant="danger" className="mb-3">
          <strong>⚠️ No Attempts Remaining</strong>
          <p className="mb-0 mt-2">
            You have used all {quiz.multipleAttempts ? quiz.howManyAttempts : 1}{" "}
            available attempts for this quiz.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={handleBack}>
              Back to Quiz Details
            </Button>
          </div>
        </Alert>
      )}

      {/* New Attempt Header */}
      {!viewingPreviousAttempt && !isSubmitted && canTakeQuiz && (
        <>
          <Alert variant="info" className="mb-3">
            ⓘ Attempt #{attemptCount + 1} of{" "}
            {quiz.multipleAttempts ? quiz.howManyAttempts : 1}
          </Alert>

          <div className="mb-4">
            <p className="mb-2">
              Started:{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {quiz.description && <p className="mb-2">{quiz.description}</p>}
            <h4>Quiz Instructions</h4>
            <hr />
          </div>
        </>
      )}

      {/* No Questions Message */}
      {quiz.questions.length === 0 &&
        (canTakeQuiz || viewingPreviousAttempt || isSubmitted) && (
          <Card className="text-center p-4">
            <Card.Body>
              <p className="text-muted">This quiz has no questions yet.</p>
            </Card.Body>
          </Card>
        )}

      {/* Single Question Display */}
      {quiz.questions.length > 0 &&
        (canTakeQuiz || viewingPreviousAttempt || isSubmitted) &&
        (() => {
          const qIndex = currentQuestionIndex;
          const question = quiz.questions[qIndex];
          const correct = isSubmitted && isAnswerCorrect(qIndex);
          const incorrect = isSubmitted && selectedAnswers[qIndex] && !correct;

          const isFillInBlank = question.type === "FIB";
          const isTrueFalse = question.type === "TF";

          const fibCorrectAnswers: string[] =
            question.answers && question.answers.length > 0
              ? question.answers
              : question.correctAnswer
              ? [question.correctAnswer]
              : [];

          const fibBlanksCount =
            isFillInBlank && fibCorrectAnswers.length > 0
              ? fibCorrectAnswers.length
              : 1;

          const fibUserAnswers = Array.isArray(selectedAnswers[qIndex])
            ? (selectedAnswers[qIndex] as string[])
            : [];

          return (
            <Card
              className={`mb-3 ${
                isSubmitted
                  ? correct
                    ? "border-success"
                    : incorrect
                    ? "border-danger"
                    : ""
                  : ""
              }`}
              style={isSubmitted ? { borderWidth: "2px" } : {}}
            >
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Question {qIndex + 1}</strong>
                </div>
                <span className="text-muted">{question.points} pts</span>
              </Card.Header>
              <Card.Body>
                <p className="mb-3">{question.questionText}</p>

                <Form>
                  {!isFillInBlank &&
                  !isTrueFalse &&
                  question.choices &&
                  question.choices.length > 0 ? (
                    // MCQ
                    <>
                      {question.choices.map(
                        (choice: string, cIndex: number) => {
                          const isSelected = selectedAnswers[qIndex] === choice;
                          const isCorrectChoice =
                            isSubmitted &&
                            choice.toLowerCase().trim() ===
                              question.correctAnswer?.toLowerCase().trim();

                          return (
                            <Form.Check
                              key={cIndex}
                              type="radio"
                              name={`question-${qIndex}`}
                              id={`q${qIndex}-choice${cIndex}`}
                              label={
                                <span>
                                  {choice}
                                  {isSubmitted && isCorrectChoice && (
                                    <span className="ms-2 text-success fw-bold">
                                      Correct
                                    </span>
                                  )}
                                  {isSubmitted &&
                                    isSelected &&
                                    !isCorrectChoice && (
                                      <span className="ms-2 text-danger fw-bold">
                                        Your answer
                                      </span>
                                    )}
                                </span>
                              }
                              value={choice}
                              checked={isSelected}
                              onChange={(e) =>
                                handleAnswerChange(qIndex, e.target.value)
                              }
                              className={`mb-2 ${
                                isSubmitted && isCorrectChoice
                                  ? "text-success fw-bold"
                                  : ""
                              }`}
                              disabled={isSubmitted || viewingPreviousAttempt}
                            />
                          );
                        }
                      )}
                    </>
                  ) : isTrueFalse ? (
                    // TRUE/FALSE
                    <>
                      {["True", "False"].map((choice, cIndex) => {
                        const isSelected = selectedAnswers[qIndex] === choice;
                        const isCorrectChoice =
                          isSubmitted &&
                          choice.toLowerCase().trim() ===
                            question.correctAnswer?.toLowerCase().trim();

                        return (
                          <Form.Check
                            key={cIndex}
                            type="radio"
                            name={`question-${qIndex}`}
                            id={`q${qIndex}-tf-${cIndex}`}
                            label={
                              <span>
                                {choice}
                                {isSubmitted && isCorrectChoice && (
                                  <span className="ms-2 text-success fw-bold">
                                    Correct
                                  </span>
                                )}
                                {isSubmitted &&
                                  isSelected &&
                                  !isCorrectChoice && (
                                    <span className="ms-2 text-danger fw-bold">
                                      Your answer
                                    </span>
                                  )}
                              </span>
                            }
                            value={choice}
                            checked={isSelected}
                            onChange={(e) =>
                              handleAnswerChange(qIndex, e.target.value)
                            }
                            className={`mb-2 ${
                              isSubmitted && isCorrectChoice
                                ? "text-success fw-bold"
                                : ""
                            }`}
                            disabled={isSubmitted || viewingPreviousAttempt}
                          />
                        );
                      })}
                    </>
                  ) : (
                    // FIB: multiple blanks
                    <div>
                      {Array.from({ length: fibBlanksCount }).map(
                        (_, blankIndex) => {
                          const correctText =
                            fibCorrectAnswers[blankIndex] || "";
                          const userText = fibUserAnswers[blankIndex] || "";
                          const thisBlankCorrect =
                            isSubmitted &&
                            userText.toString().trim().toLowerCase() ===
                              correctText.toString().trim().toLowerCase();

                          return (
                            <Form.Group key={blankIndex} className="mb-2">
                              <Form.Label>Blank {blankIndex + 1}</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="Enter your answer"
                                value={userText}
                                onChange={(e) =>
                                  handleFibAnswerChange(
                                    qIndex,
                                    blankIndex,
                                    e.target.value,
                                    fibBlanksCount
                                  )
                                }
                                disabled={isSubmitted || viewingPreviousAttempt}
                                className={
                                  isSubmitted
                                    ? thisBlankCorrect
                                      ? "border-success"
                                      : "border-danger"
                                    : ""
                                }
                              />
                            </Form.Group>
                          );
                        }
                      )}
                      {isSubmitted && fibCorrectAnswers.length > 0 && (
                        <Form.Text
                          className={correct ? "text-success" : "text-danger"}
                        >
                          Correct answers: {fibCorrectAnswers.join(", ")}
                        </Form.Text>
                      )}
                    </div>
                  )}
                </Form>
              </Card.Body>
            </Card>
          );
        })()}

      {/* Navigation Buttons */}
      {quiz.questions.length > 0 &&
        quiz.oneQuestionAtATime &&
        (canTakeQuiz || viewingPreviousAttempt || isSubmitted) && (
          <div className="d-flex justify-content-between align-items-center mb-4">
            {currentQuestionIndex > 0 ? (
              <Button variant="secondary" onClick={handlePreviousQuestion}>
                ‹ Previous
              </Button>
            ) : (
              <div></div>
            )}
            {currentQuestionIndex < quiz.questions.length - 1 && (
              <Button variant="secondary" onClick={handleNextQuestion}>
                Next ›
              </Button>
            )}
          </div>
        )}

      {/* Submit Button */}
      {!isSubmitted &&
        !viewingPreviousAttempt &&
        canTakeQuiz &&
        quiz.questions.length > 0 && (
          <Card className="mt-4 mb-4">
            <Card.Body className="d-flex justify-content-end align-items-center gap-3">
              <span className="text-muted">
                {lastSavedTime && `Quiz saved at ${lastSavedTime}`}
              </span>
              <Button variant="danger" onClick={handleSubmit}>
                Submit Quiz
              </Button>
            </Card.Body>
          </Card>
        )}

      {/* Question Navigation */}
      {quiz.questions.length > 0 &&
        (canTakeQuiz || viewingPreviousAttempt || isSubmitted) && (
          <div className="mt-4 mb-4">
            <h5 className="mb-3">Questions</h5>
            <div className="d-flex flex-column gap-2 ms-3">
              {quiz.questions.map((_: any, idx: number) => {
                const isCurrent = idx === currentQuestionIndex;
                const answered = selectedAnswers[idx] !== undefined;
                const correct = isSubmitted && isAnswerCorrect(idx);
                const incorrect = isSubmitted && answered && !correct;

                return (
                  <a
                    key={idx}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleJumpToQuestion(idx);
                    }}
                    style={{
                      color: "red",
                      fontWeight: isCurrent ? "bold" : "normal",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    Question {idx + 1}
                  </a>
                );
              })}
            </div>
          </div>
        )}

      {/* After Submission */}
      {isSubmitted && !viewingPreviousAttempt && (
        <Card className="mt-4 mb-4">
          <Card.Body className="text-center">
            <h5>
              Quiz submitted at{" "}
              {new Date().toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </h5>
            <p className="mt-2">
              Your score:{" "}
              <strong>
                {score} / {totalPoints}
              </strong>{" "}
              points
            </p>
            {canTakeQuiz && (
              <div className="mt-3">
                <Button
                  variant="primary"
                  onClick={handleStartNewAttempt}
                  className="me-2"
                >
                  Take Quiz Again ({attemptsRemaining} attempts remaining)
                </Button>
              </div>
            )}
            {!canTakeQuiz && (
              <Alert variant="warning" className="mt-3">
                You have used all available attempts for this quiz.
              </Alert>
            )}
            <div className="mt-3">
              <Button variant="secondary" onClick={handleBack}>
                Back to Quiz Details
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
