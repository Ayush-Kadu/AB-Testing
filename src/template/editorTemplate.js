const getTemplate = (content) => {
    if (!Array.isArray(content)) {
        throw new Error('Content must be an array');
    }

    let html = '';

    // Process each block in the content array
    content.forEach(block => {
        if (block.type === 'paragraph') {
            // Start paragraph tag
            let paragraphHtml = '<p>';

            // Process children (text nodes)
            if (Array.isArray(block.children)) {
                block.children.forEach(child => {
                    let text = child.text || '';

                    // Apply formatting if present
                    if (child.bold) {
                        text = `<strong>${text}</strong>`;
                    }
                    if (child.italic) {
                        text = `<em>${text}</em>`;
                    }
                    if (child.underline) {
                        text = `<u>${text}</u>`;
                    }

                    paragraphHtml += text;
                });
            }

            // Close paragraph tag
            paragraphHtml += '</p>';

            // Add to HTML output
            html += paragraphHtml;
        } else {
            // Handle other block types if needed
            console.warn(`Unhandled block type: ${block.type}`);
        }
    });

    return html;
}

module.exports = { getTemplate }