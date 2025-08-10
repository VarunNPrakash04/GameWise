// script.js

// --- 1. SETUP THE KONVA STAGE ---

// We define the width and height for our canvas.
// This should match the dimensions of your board image for the best results.
const STAGE_WIDTH = 600;
const STAGE_HEIGHT = 465;

// Konva works by creating a "Stage" which is the main canvas area.
// We attach it to the div we created in our HTML.
const stage = new Konva.Stage({
  container: 'board-container', // The id of the div
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
});

// A stage can have multiple "Layers". Think of them like sheets of glass
// stacked on top of each other. We'll draw our board on one layer,
// and our wires on another layer on top of it.
const boardLayer = new Konva.Layer();
const wireLayer = new Konva.Layer();

// Add the layers to the stage
stage.add(boardLayer);
stage.add(wireLayer);


// --- 2. LOAD THE ARDUINO BOARD IMAGE ---

// We create a new JavaScript Image object.
const boardImage = new Image();

// We set the `src` to the path of your image file.
// Make sure you have saved the image as 'arduino-board.png' in the same folder.
boardImage.src = 'pngegg.png'; // Make sure this filename matches yours!

// Images load asynchronously, so we need to wait for it to be fully loaded
// before we can add it to our layer.
boardImage.onload = function () {
  // Now that the image is loaded, we create a Konva.Image object.
  const arduino = new Konva.Image({
    x: 0,
    y: 0,
    image: boardImage,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  });

  // Add the Konva image to our board layer.
  boardLayer.add(arduino);

  // Redraw the layer to show the image.
  boardLayer.draw();

  console.log('Board image loaded successfully!');
};

// Log an error if the image fails to load.
boardImage.onerror = function() {
    console.error('Failed to load the board image. Make sure the file is in the correct folder and the name is correct in script.js');
}

// --- 3. WIRING LOGIC (Coming Next!) ---
// This is where we will add the code for our amazing wire-drawing tool.

console.log('Konva stage is set up. Ready to build!');