"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Form } from "react-bootstrap";
import * as client from "../../../client";
import MCQEditor from "./mcq";
import TFEditor from "./tf";
import FIBEditor from "./fib";

/* eslint-disable @typescript-eslint/no-explicit-any */
//useEffect loads data when params change
//THIS PAGE DOESNT HANDLE ANY INPUTS, IT DELEGATES EDITING TO ONE OF THESE COMPONENTS
//renders the correct component inside the card

export default function QuestionEditorPage() {
  //used to get the [cid], [qid], and [questionid]
  const params = useParams();
  //to be able to go to different pahes
  const router = useRouter();

  //make variables out of the stuff extracted from the url
  //to be able to know which quiz and which question to edit
  const courseId = params.cid as string;
  const quizId = params.qid as string;
  const questionId = params.questionId as string;

  //making state variables for quiz , question, and loading
  //all start at null before we fetch the datat
  const [quiz, setQuiz] = useState<any | null>(null);
  const [question, setQuestion] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Load quiz AND current question (or default new which is the multiple choice!)
  //MOST IMPORTANT FUNCTION
  useEffect(() => {
    const load = async () => {
      //get the quiz using the client apa funciton
      const data = await client.findQuizById(quizId);
      //gets the questions array (which can get empty )
      const questions = data.questions || [];

      let current: any | undefined;

      //SET THE "current Question" --> all properties in the database!
      //if new then just set some default vals
      if (questionId === "new") {
        current = {
          type: "MCQ",
          questionText: "New Question",
          points: 1,
          choices: ["Option 1", "Option 2", "Option 3", "Option 4"],
          correctAnswer: "Option 1",
        };
      } else {
        //editing existing questions
        //multiple ways to try to get the question id
        //set the questionId to whatever way you were able to grab that
        current = questions.find(
          (q: any) =>
            q._id === questionId ||
            q._id?.toString?.() === questionId ||
            q._id?.$oid === questionId
        );
      }

      //update state vars using these vals
      //updates the entire quiz
      setQuiz(data);
      //either use the current questison or use the default
      setQuestion(
        current || {
          type: "MCQ",
          questionText: "",
          points: 1,
          choices: ["Option 1", "Option 2"],
          correctAnswer: "Option 1",
        }
      );
      setLoading(false);
    };

    load();
  }, [quizId, questionId]); //re-run this effect on re render or when the quizid, questionid re runs

  //ALL THE HANDLER FUNCTIONS FOR THE BUTTONS!

  //when the person clicks cancel the person will navigate back to the questions editor tab
  const handleCancel = () => {
    router.push(`/Courses/${courseId}/Quizzes/${quizId}/questions`);
  };

  //if either the question or the quiz is null then dont do anything! (just an etxra guard)

  const handleSave = async () => {
    if (!quiz || !question) return;

    //get the current questions list and define the updated question list
    const existing = quiz.questions || [];
    let updatedQuestions: any[];
    //adds new questions to the array if new
    if (questionId === "new") {
      updatedQuestions = [...existing, question];
    } else {
      updatedQuestions = existing.map((q: any) => {
        if (
          q._id === questionId ||
          q._id?.toString?.() === questionId ||
          q._id?.$oid === questionId
        ) {
          //updates the question once it is found, this overrites the fieldst that have changed
          //wit the edit ones
          return { ...q, ...question };
        }
        return q;
      });
    }

    const totalPoints = updatedQuestions.reduce(
      (sum: number, q: any) => sum + (q.points || 0),
      0
    );

    //update the quiz onject
    const updatedQuiz = {
      ...quiz,
      questions: updatedQuestions,
      points: totalPoints,
      numberOfQuestions: updatedQuestions.length,
    };

    //send updated quiz stuff back to the client
    await client.updateQuiz(quizId, updatedQuiz);
    router.push(`/Courses/${courseId}/Quizzes/${quizId}/questions`);
  };

  //when the user uses the drop down to chnage the the type the state is updated
  //to match that type
  const handleTypeChange = (newType: string) => {
    if (!question) return;

    //setQuestion from the state variable
    setQuestion((prev: any) => {
      //base obect with updated type
      const base = {
        ...prev,
        type: newType,
        questionText: prev.questionText || "",
        points: prev.points ?? 1,
      };

      //just creating some default values for question type
      //spreads the values that every type of question shares
      //keep old value or default to true true
      //BOOLEAN ANSWERS
      if (newType === "TF") {
        return {
          ...base,
          correctAnswer:
            prev.correctAnswer === "false" || prev.correctAnswer === false
              ? "false"
              : "true",
        };
      }

      //default is one empty but in fill in the blanks it is an answers array
      //ANSWERS ARRAY
      if (newType === "FIB") {
        return {
          ...base,
          answers: prev.answers || [""],
        };
      }

      // Multiple Choice default answer
      //two choices are the default if none exist
      //JUST ONE CORRECT ANSWER
      return {
        ...base,
        choices:
          prev.choices && prev.choices.length
            ? prev.choices
            : ["Option 1", "Option 2"],
        correctAnswer: prev.correctAnswer || "Option 1",
      };
    });
  };

  //just a loading guard for the loading state
  //if any of these are loading stop rendering the question page and show the message!
  if (loading || !quiz || !question) {
    return <div className="p-3">Loading question...</div>;
  }

  //GETS THE QUESTION TYPE FROM THE STATE
  //defaults to mcq
  const type = (question.type || "MCQ").toUpperCase();

  //chooses the correct editor component depedning on the question type
  //CONDITIONALLY RENDER COMPONNENT
  //props are passed to each component
  let editorBody;
  if (type === "TF") {
    editorBody = <TFEditor question={question} setQuestion={setQuestion} />;
  } else if (type === "FIB") {
    editorBody = <FIBEditor question={question} setQuestion={setQuestion} />;
  } else {
    editorBody = <MCQEditor question={question} setQuestion={setQuestion} />;
  }

  //UI RENDERING
  return (
    <div className="p-3">
      {/**card and card header */}
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Question Editor</strong>
          {/** the drop down, updates question state, gets the value from the
           * select element and passes it to handleTypeChange
           */}
          <Form.Select
            style={{ maxWidth: "220px" }}
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="MCQ">Multiple Choice</option>
            <option value="TF">True / False</option>
            <option value="FIB">Fill in the Blank</option>
          </Form.Select>
        </Card.Header>
        {/**what changes the form for either mcq, tf, or fib */}
        <Card.Body>{editorBody}</Card.Body>
      </Card>

      {/**just the bottom buttons */}
      <div className="d-flex justify-content-end gap-2">
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleSave}>
          Save Question
        </Button>
      </div>
    </div>
  );
}
