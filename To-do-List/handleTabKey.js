const textarea = document.querySelectorAll('.task-input');

textarea.forEach(element => {

    element.addEventListener('keydown', function(event) {

        // check if the Tab key is pressed
        if (event.key === 'Tab') {
            
            // prevent the default behavior (moving to the next element)
            event.preventDefault();

            // insert a tab character ('\t') at the current cursor position
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
            
            // move the cursor to the position after the inserted tab
            this.selectionStart = this.selectionEnd = start + 1;
        }
    });
});
