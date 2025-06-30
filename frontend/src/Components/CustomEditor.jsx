import {useEffect, useRef} from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export default function QuillEditor({value, onChange, readOnly = false}) {
    const editorRef = useRef(null);
    const quillInstance = useRef(null);

    useEffect(() => {
        if (editorRef.current && !quillInstance.current) {
            // Define toolbar only when not in readOnly mode
            const modules = readOnly
                ? { toolbar: false }
                : {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{'header': 1}, {'header': 2}],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        [{'script': 'sub'}, {'script': 'super'}],
                        [{'indent': '-1'}, {'indent': '+1'}],
                        [{'direction': 'rtl'}],
                        [{'size': ['small', false, 'large', 'huge']}],
                        [{'header': [1, 2, 3, 4, 5, 6, false]}],
                        [{'color': []}, {'background': []}],
                        [{'font': []}],
                        [{'align': []}],
                        ['link'],
                        ['clean']
                    ]
                };

            quillInstance.current = new Quill(editorRef.current, {
                theme: 'snow',
                readOnly: readOnly,
                modules: modules
            });

            quillInstance.current.on('text-change', () => {
                onChange && onChange(quillInstance.current.root.innerHTML);
            });

            if (value) {
                quillInstance.current.root.innerHTML = value;
            }
        }
    }, [value, onChange, readOnly]);

    return <div ref={editorRef}/>;
}