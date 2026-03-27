const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const calculationsPath = path.join(__dirname, '..', 'app', 'Calculations', 'calculations.js');
const calculationsScript = fs.readFileSync(calculationsPath, 'utf8');

const fieldIds = [
    'consumablesexclmiscField',
    'Contract_SumField',
    'Contract_SumField1',
    'MaterialCostField',
    'MaterialCost1Field',
    'ConsumbaleCostField',
    'LabourCostField',
    'LabourCost1Field',
    'GrossProfitField',
    'GrossProfit1Field',
    'LabourSalesField',
    'LabourSalesFieldone',
    'MaterialSalesField',
    'MaterialSalesFieldone',
    'ConsumableSalesField',
    'ConsumablesSalesFieldOne',
    'GPField',
    'GPFieldone',
    'TotalM2Field',
    'TotalM2Fieldone',
    'TotalMandaysField',
    'TotalMandaysFieldone',
    'RevenueMandayField',
    'RevenueMandayFieldone',
    'GPMandayField',
    'GPMandayFieldone'
];

const extraFieldsHtml = fieldIds
    .map((id) => `<input id="${id}" value="0">`)
    .join('');

const html = `<!DOCTYPE html>
<html>
<body>
    ${extraFieldsHtml}
    <div id="calcTriggerLog"></div>
    <table id="boqSubform">
        <tbody>
            <tr>
                <td><input type="checkbox"></td>
                <td><input type="number" value="1"></td>
                <td><input type="text" value="Service"></td>
                <td><textarea>Description</textarea></td>
                <td><input type="text" value="m2"></td>
                <td><input id="qtyInput" class="boq-quantity-input" type="number" value="1" oninput="handleBOQQuantityInput(event)" onchange="handleBOQQuantityInput(event)"></td>
                <td><input type="text" value="0"></td>
                <td><input type="text" value="0"></td>
                <td><input type="number" value="10"></td>
                <td><input type="number" value="0"></td>
                <td><input id="amountInput" type="number" value="0"></td>
                <td><input type="number" value="0"></td>
                <td><input type="number" value="0"></td>
            </tr>
        </tbody>
    </table>
    <table id="materialsSubform"><tbody></tbody></table>
</body>
</html>`;

const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/'
});

const { window } = dom;
const logs = [];

window.console.log = (...args) => logs.push(args.join(' '));
window.console.warn = (...args) => logs.push(args.join(' '));
window.console.error = (...args) => logs.push(args.join(' '));

window.eval(calculationsScript);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const qtyInput = window.document.getElementById('qtyInput');
qtyInput.value = '2';
qtyInput.dispatchEvent(new window.Event('input', { bubbles: true }));

assert.equal(window.document.getElementById('amountInput').value, '20');
assert.ok(
    logs.some((entry) => entry.includes('BOQ Quantity changed via inline handler. Line: 1, Quantity: 2')),
    'Expected BOQ quantity change log to be emitted.'
);
assert.match(
    window.document.getElementById('calcTriggerLog').textContent,
    /BOQ Quantity changed via inline handler\. Line: 1, Quantity: 2/
);

console.log('BOQ quantity trigger test passed.');