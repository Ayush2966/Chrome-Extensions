// Get references to the HTML elements we need to manipulate
const fileInput = document.getElementById('file-input');
const extractButton = document.getElementById('extract-button');
const resultText = document.getElementById('response');
const radioButtons = document.querySelectorAll('.radio-buttons input[type="radio"]');
const formData = new FormData();

radioButtons.forEach(radioButton => {
  radioButton.addEventListener('click', () => {
    const labels = document.querySelectorAll('.radio-buttons label');
    labels.forEach(label => {
      label.classList.remove('checked');
    });
    radioButton.parentElement.classList.add('checked');
    formData.set('ocrEngine', radioButton.value);
    console.log(formData.get('ocrEngine'));
  });
});

// set the initial value of the "ocrEngine" field
const initialRadioButton = document.querySelector('.radio-buttons input[type="radio"]:checked');
formData.set('ocrEngine', initialRadioButton.value);
function displayName(name) {
      const words = name.split(" ");
      let firstName, lastName;

      if (words.length === 3) {
        firstName = words.slice(0, 2).join(" ");
        lastName = words[2];
      } else if (words.length === 2) {
        firstName = words[0];
        lastName = words[1];
      } else {
        console.error("Invalid name format");
      }
      console.log(words);
      console.log(firstName); // Output: "MOHAMMAD HABIBUR"
  console.log(lastName); // Output: "RAHMAN"
  
}

// Function to handle the "Extract Text" button click
function handleExtractClick() {
  // Get the file object from the file input
  const file = fileInput.files[0];
  if (!file) {
    console.error('No file selected');
    return;
  }

  // Create a new form data object and add the file to it
  formData.append('image', file);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'true');
  formData.append('detectOrientation', 'true');
// Console all info from form data
  for (var value of formData.values()) {
    console.log(value);
  }
  // Make a POST request to the OCR.Space API with the form data
  fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      'apikey': 'aeea54b48988957'
    },
    body: formData
  }) // Convert the response to JSON
  .then(response => response.json())
    .then(data => {
     

      console.log(data);
    // Check that the ParsedResults property exists and is an array
    if (data.ParsedResults && Array.isArray(data.ParsedResults)) {
      // Get the extracted text from the first ParsedResult object in the array
      const extractedText = data.ParsedResults[0].ParsedText;
      // Display the extracted text in the result text element
      resultText.value = extractedText;
      console.log(extractedText);
      // After the text is extracted, clear the file input
      fileInput.value = '';
       //  response data to json
      const text = extractedText;
      const regex = /(?<=Name:)[^a-zA-Z\s]*(?<name>[a-zA-Z\s]+)[^a-zA-Z\s]*(?=Father's Name)/;
      const match = text.match(regex);
      const name = match?.groups?.name; // "MST NAJMA BEGUM"

      /* const regex2 = /(?<=Father's Name)[^a-zA-Z\s]*(?<name>[a-zA-Z\s]+)[^a-zA-Z\s]*(?=Mother's Name:)/;
      const match2 = text.match(regex2);
      const fatherName = match2?.groups?.name; // "MST NAJMA BEGUM" */
      displayName(name);

    } else {
      // Handle the case where the ParsedResults property is missing or not an array
      console.error('Invalid response data: missing or invalid ParsedResults property');
    }
  })
  .catch(error => {
    // Handle any errors that occur during the request
    console.error(error);
  });
}

// Add a click event listener to the "Extract Text" button
extractButton.addEventListener('click', handleExtractClick);
