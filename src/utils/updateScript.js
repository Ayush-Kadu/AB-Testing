const fs = require('fs');
const path = require('path');


function updateScript(popupContent,userId,time) {
    //const filePath = path.join(__dirname, ../scripts/scripts-${userId}-${milliseconds}.js);
const filePath = path.join(__dirname, `../scripts/scripts-${userId}.js`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.log('error reading file')
        }
    
        // const modifiedData = data + '\n// New line added by the server';
        const modifiedData = popupContent;
    
        fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
            if (err) {
                console.log('Error modifying the file');
          }
          console.log('File modified successfully');
          
        });
      });
}
 
module.exports = updateScript;
