const fs = require('fs');
const path = require('path');


function deleteScript(timeStamps, userId) {
    const milliseconds = new Date(timeStamps).getTime();
    //const filePath = path.join(__dirname, `../scripts/scripts-${userId}-${milliseconds}.js`);

const filePath = path.join(__dirname, `../scripts/scripts-${userId}.js`);
    fs.unlink(filePath, (err) => {
        if (err) {
            console.log(`Error deleting file: ${err.message}`);
            
        } else {
            console.log(`File ${filePath} has been deleted`);
        }
    });
}

module.exports = deleteScript;
