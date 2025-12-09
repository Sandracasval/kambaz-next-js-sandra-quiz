// Quiz Questions Page - showing all Questions - Bhavya/Sandra
// app/Courses/[cid]/Quizzes/[qid]/questions/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, ListGroup, Nav } from "react-bootstrap";
import { BsPlus, BsTrash } from "react-icons/bs";
import * as client from "../../client";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function QuizQuestionsList() {
  //gets the values from the dynamic folder! like [qid] and [cid]
  const params = useParams();
  //pushes navigation to other pages
  const router = useRouter();
  //getting the cid and qid from the URL for rendering!
  const courseId = params.cid as string;
  const quizId = params.qid as string;

  //STATE VARS ARE THE CURRENT VALUES OF THE FIELDS
  //starting val is empty, we use quiz because thats how we set it up in the db
  //starts as empty because the data hasnt been fetched yet
  //<ANY | NULL> MEANS THE STATE CAN BE EITHER NULL AT FIRST OR LATER BECOME ANY TYPE
  const [quiz, setQuiz] = useState<any | null>(null);
  //if loading is true!
  //DELETE THIS ONE: prevents the component from trying to access quiz.questions
  //what is shown before the data exists
  //without it might create errors
  const [loading, setLoading] = useState(true);

  //set quiz updates the qyiz state and triggers a re-render.
  //uses API function from back end (triggers get)
  const loadQuiz = async () => {
    const data = await client.findQuizById(quizId);
    //spreads quiz data and makes questions an array 
    //and turns loading off 
    setQuiz({
      ...data,
      questions: data.questions || [],
    });
    setLoading(false);
  };

  //is used when the page is refreshed 
  //triggers load quiz if quizid is changed
  //quizid is because it loads if the quiz changes (dependency)
  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  //navigates to the new questions page and builds a new url 
  const handleAddQuestion = () => {
    router.push(`/Courses/${courseId}/Quizzes/${quizId}/questions/new`);
  };

  //takes a question object and uses its id to build a url 
  const handleEditQuestion = (question: any) => {
    router.push(
      `/Courses/${courseId}/Quizzes/${quizId}/questions/${question._id}`
    );
  };

  //if quiz is null then return.exit
  //filter removes the question at that index from the questions array 
  //reduce recomputes the total points from the questions
  //updatedQuiz updates the quiz 
  //sends new quiz to the back end using updateQuiz
  //uses the setQuiz state variable to refresh the total state 
  //the index comes from the .map(function)
  const handleDeleteQuestion = async (index: number) => {
    if (!quiz) return;

    //keep every question except the one were deleting
    //actual question paramater is ignored we only care about the index
    const updatedQuestions = quiz.questions.filter(
      (_: any, i: number) => i !== index
    );

    const totalPoints =
      updatedQuestions?.reduce(
        (sum: number, q: any) => sum + (q.points || 0),
        0
      ) ?? 0;

    const updatedQuiz = {
      ...quiz,
      questions: updatedQuestions,
      points: totalPoints,
      numberOfQuestions: updatedQuestions.length,
    };

    const saved = await client.updateQuiz(quizId, updatedQuiz);
    // refresh local state from server response
    setQuiz({
      ...saved,
      questions: saved.questions || [],
    });
  };

  const handleCancel = () => {
    // GO BACK TO THE QUIZ DETAILS!
    //doesnt send any data
    router.push(`/Courses/${courseId}/Quizzes/${quizId}`);
  };

  //also doesnt do anything if the quiz is empty so just exists 
  //also recomputes points 
  //update sthe quiz (spreads existing quiz, updates points and numbr of questions)
  //sends it back to the backend vis updateQuiz 
  //navigates back to the quiz details page at the end
  const handleSave = async () => {
    if (!quiz) return;

    // recompute points & numberOfQuestions from current quiz.questions
    const totalPoints =
      quiz.questions?.reduce(
        (sum: number, q: any) => sum + (q.points || 0),
        0
      ) ?? 0;

    const updatedQuiz = {
      ...quiz,
      points: totalPoints,
      numberOfQuestions: quiz.questions.length,
    };

    await client.updateQuiz(quizId, updatedQuiz);
    router.push(`/Courses/${courseId}/Quizzes/${quizId}`);
  };

  //message displayed if the loading variable is set to true 
  if (loading || !quiz) {
    return <div className="p-3">Loading questions...</div>;
  }

  //Calculates total point value is used in the ui 
  const totalPoints =
    quiz.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) ??
    0;

  return (
    //p-3 applies padding around the edges 
    //default activeKey makes Questions the active tab on this page
    //mb-3 just gives space between the margin and the content
    //eventKey is an id for the tab 
    //no click on this link because were already there 
    <div className="p-3">
      <Nav variant="tabs" defaultActiveKey="questions" className="mb-3">
        <Nav.Item>
          <Nav.Link
            eventKey="details"
            onClick={() =>
              router.push(`/Courses/${courseId}/Quizzes/${quizId}/Editor`)
            }
          >
            Details
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="questions">Questions</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Header: count + New Question + total points 
      flex box container 
      <flexbox separates from divs>
      questions.lenght is derived from state 
      so it updates automatically
      fs4 is the size of the text*/}
      
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-0">Questions ({quiz.questions.length})</h5>
          <small className="text-muted">
            Points: <strong>{totalPoints}</strong>
          </small>
        </div>
        <Button variant="danger" onClick={handleAddQuestion}>
          <BsPlus className="fs-5" /> New Question
        </Button>
      </div>



{/** what is rendered when there are no questions */}
      {quiz.questions.length === 0 && (
        <Card className="text-center p-4 mb-3">
          <Card.Body>
            <p className="text-muted">
              No questions exist for this quiz yet. Click &quot;New Question&quot; to create one.
            </p>
          </Card.Body>
        </Card>
      )}

{/** what is rendered when there are questions
 * list gropup is just a wrapper for the cards in a vertical matter
 * one card per question
 * for every question do this 
 * use the question id as a key
 * uses normal numbering
 * key similar to an id 
 */}
      <ListGroup>
        {quiz.questions.map((question: any, qIndex: number) => (
          <Card key={question._id ?? qIndex} className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <strong>
                Question {qIndex + 1}
                {question.questionText ? `: ${question.questionText}` : ""}
              </strong>

              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleEditQuestion(question)}
                  disabled={!question._id}
                >
                  Edit
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteQuestion(qIndex)}
                >
                  <BsTrash />
                </Button>
              </div>
            </Card.Header>
          </Card>
        ))}
      </ListGroup>
      {/** just adding a horizontal division*/}
      <hr className="mt-4" />

      {/** save and cancel buttons  */}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
