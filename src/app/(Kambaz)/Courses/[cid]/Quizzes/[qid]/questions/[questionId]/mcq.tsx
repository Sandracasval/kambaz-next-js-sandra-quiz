import { Button, Form } from "react-bootstrap";

//students select one multiple choice
/* eslint-disable @typescript-eslint/no-explicit-any */

//MUST BE ABLE TO CHANGE TITLE (TEXT INPUT)
//POINTS (NUMBER INPUT)
//QUESTION:
//CHOICES (TEXT AREA): FACULTY CAN ADD OR REMOVE ANY # OF CHOICES
//CANCEL BUTTON THAT DISCARDS CHANGES

//props to be used by the MCQ Editor component
interface Props {
  question: any;
  setQuestion: (q: any) => void;
}

//react component that recieves the mcq auestion
//question has all of the question data
//destructs values out of the prop
export default function MCQEditor({ question, setQuestion }: Props) {
  //used by text area and  points
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    //grabs which field change by its name and what its new value is
    const { name, value } = e.target;
    //udpates the question object
    //copy eerything from the current question and then override that specific field
    //if the field being edited is points then store as a number if not just
    //store the string as its typed
    //value if true and value if false
    //I did it on one because they both have name and on change
    setQuestion({
      ...question,
      [name]: name === "points" ? Number(value) || 0 : value,
    });
  };

  //index (choice) being updated), value: the text for that choice that was typed]
  //copies the hoices array, updates that choice
  const handleChoiceChange = (index: number, value: string) => {
    const updated = [...question.choices];
    updated[index] = value;
    setQuestion({ ...question, choices: updated });
  };

  //also deals with choices array but simple adds one more option
  //copies the exisintig question array and add it at the end
  //also assigns default name for choice
  const handleAddChoice = () => {
    setQuestion({
      ...question,
      choices: [...question.choices, `Option ${question.choices.length + 1}`],
    });
  };

  //removes teh choice from the choices array by using filter and its id
  //if the deleted answer was the correct choice make the first choice the correct amswer
  const handleRemoveChoice = (index: number) => {
    const updated = question.choices.filter(
      (_: string, i: number) => i !== index
    );

    let correct = question.correctAnswer;
    if (!updated.includes(correct) && updated.length > 0) {
      correct = updated[0];
    }

    //update the question state on the changes array and the correct answer
    setQuestion({ ...question, choices: updated, correctAnswer: correct });
  };

  //CONTROLLED BY THE RADIO BUTTONS
  const handleCorrectChange = (choice: string) => {
    setQuestion({ ...question, correctAnswer: choice });
  };

  return (
    <>
      {/**allows you to change the question title!
       * name is used by the handleFieldChange as the
       */}
      <Form.Group className="mb-3">
        <Form.Label>Question Text</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          name="questionText"
          value={question.questionText}
          onChange={handleFieldChange}
        />
      </Form.Group>

      {/**allows you to change the number of points
       */}
      <Form.Group className="mb-3" style={{ maxWidth: "150px" }}>
        <Form.Label>Points</Form.Label>
        <Form.Control
          type="number"
          name="points"
          value={question.points}
          onChange={handleFieldChange}
        />
      </Form.Group>

      {/**form group for the answer choices  */}
      <Form.Group className="mb-3">
        <Form.Label>Answer Choices</Form.Label>
        {/**each choice in the array gets a row and an index */}
        {question.choices.map((choice: string, index: number) => (
          <div key={index} className="d-flex align-items-center mb-2 gap-2">
            <Form.Check
              type="radio"
              name="correctChoice"
              checked={question.correctAnswer === choice}
              onChange={() => handleCorrectChange(choice)}
              className="me-2"
            />
            <Form.Control
              type="text"
              value={choice}
              onChange={(e) => handleChoiceChange(index, e.target.value)}
            />
            {/**ONLY RENDERED WGHEN THERE ARE MORE THAN 2 CHOICES  */}
            {question.choices.length > 2 && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleRemoveChoice(index)}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline-secondary"
          size="sm"
          className="mt-2"
          onClick={handleAddChoice}
        >
          + Add Choice
        </Button>
      </Form.Group>

      <div className="text-muted small">
        <strong>Correct Answer:</strong> {question.correctAnswer}
      </div>
    </>
  );
}
