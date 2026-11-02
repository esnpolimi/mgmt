const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {runInNewContext} = require('node:vm');
const {transformSync} = require('esbuild');
const {jsx, jsxs} = require('react/jsx-runtime');

test('wishlist blocks duplicate POSTs, resets after errors, and preserves success', () => {
    const hooks = [];
    const requests = [];
    let cursor = 0;
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = initial;
            return [hooks[index], value => { hooks[index] = value; }];
        },
        useRef(initial) {
            const index = cursor++;
            return hooks[index] ??= {current: initial};
        },
    };
    const source = readFileSync(join(__dirname, 'Wishlist.jsx'), 'utf8');
    const {code} = transformSync(source, {loader: 'jsx', format: 'cjs', jsx: 'automatic'});
    const module = {exports: {}};
    runInNewContext(code, {
        module,
        exports: module.exports,
        require(name) {
            if (name === 'react') return react;
            if (name === 'react/jsx-runtime') return {jsx, jsxs};
            if (name === '@mui/material') return new Proxy({}, {get: (_, key) => key});
            if (name === '../api/api') return {fetchCustom: (...args) => requests.push(args)};
            if (name === '../assets/esnpolimi-logo.png') return 'logo.png';
            throw new Error(`Unexpected import: ${name}`);
        },
    });
    const render = () => {
        cursor = 0;
        return module.exports.default();
    };
    const find = (node, predicate) => {
        if (!node || typeof node !== 'object') return undefined;
        if (predicate(node)) return node;
        return [node.props?.children].flat(Infinity)
            .map(child => find(child, predicate)).find(Boolean);
    };
    const event = {preventDefault() {}};
    const lookupForm = find(render(), node => node.props?.component === 'form');
    lookupForm.props.onSubmit(event);
    requests[0][2].onSuccess({verified: true});
    requests[0][2].onFinally();
    const submit = find(render(), node => node.props?.component === 'form').props.onSubmit;
    submit(event);
    submit(event);
    assert.equal(requests.length, 2, 'same-render duplicate must not POST');
    assert.equal(requests[1][0], 'POST');
    assert.equal(requests[1][1], '/content/wishlist/');
    let tree = render();
    let button = find(tree, node => node.type === 'Button');
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.children, 'Submitting...');
    find(tree, node => node.props?.component === 'form').props.onSubmit(event);
    assert.equal(requests.length, 2, 'pending rerender must not POST');
    requests[1][2].onError();
    tree = render();
    assert.ok(find(tree, node => node.props?.children === 'Unable to submit the request.'));
    assert.equal(find(tree, node => node.type === 'Button').props.disabled, true);
    requests[1][2].onFinally();
    tree = render();
    button = find(tree, node => node.type === 'Button');
    assert.equal(button.props.disabled, false);
    assert.equal(button.props.children, 'Submit idea');
    find(tree, node => node.props?.component === 'form').props.onSubmit(event);
    assert.equal(requests.length, 3, 'failed submissions can be retried');
    requests[2][2].onSuccess();
    requests[2][2].onFinally();
    assert.ok(find(render(), node => node.props?.children === 'Thank you!'));
});
