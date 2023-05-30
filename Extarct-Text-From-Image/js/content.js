// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "extractText") {
    // Get the URL of the image from the popup message
    const imageUrl = request.imageUrl;

    // Create an image element to load the image
    const image = new Image();
    image.src = imageUrl;
    image.onload = function() {
      // Use Tesseract.js to extract text from the image
      Tesseract.recognize(image)
        .then(function(result) {
          // Get the extracted text from the Tesseract result
          const extractedText = result.text;

          // Fill input fields on the current page with the extracted text
          const inputFields = document.querySelectorAll("input");
          inputFields.forEach(function(input) {
            input.value = extractedText;
          });

          // Send a response to the popup with the extracted text
          sendResponse({ extractedText: extractedText });
        })
        .catch(function(error) {
          console.error(error);
        });
    };
  }

  // Return true to indicate that we want to send a response asynchronously
  return true;
});
