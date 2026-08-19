# THE TAX CUP

A browser-based Nigerian PAYE salary calculator branded for The Tax Cup, with two modes:

- **Gross to net:** estimate monthly take-home pay, PAYE and deductions.
- **Net to gross:** solve for the gross salary needed to deliver a target take-home amount.
- **Gross composition:** allocate gross salary across Basic, Housing, Transport and Other Allowances using editable percentages.
- **Employee report:** enter an employee name and use **Print / PDF** to print or save a complete branded salary report as PDF.
- **Multiple employees:** open `employees.html` to calculate and report salary obligations for a whole team in one pass.

The interface uses the Tax Cup gold-and-ink palette, with the logo in `tax-cup-logo.svg` and the brand tagline: **SIMPLIFYING TAX & COMPLIANCE FOR BUSINESSES**.

## Multiple employees

The **Multiple employees** page allows HR or payroll teams to add as many employee rows as needed. Shared composition percentages, pension, NHF, annual rent relief and calculation mode are applied to every row. The team report shows each employee's gross, Basic, Housing, Transport, Other Allowances, PAYE, pension, NHF and net pay, plus the total net payroll. Use **Print / PDF** to print or save the team report.

## Run it

Open `index.html` in a browser. No installation or build step is required. In VS Code, use **Open with Live Server** if that extension is installed.

## Current model

The starter model in `app.js` uses these configurable 2026 assumptions:

- Annual tax-free band: NGN 800,000
- Progressive annual bands: 15%, 18%, 21%, 23%, 25%
- Employee pension: 8% of gross salary
- NHF: 2.5% of gross salary

These are implementation assumptions for the calculator and should be reviewed against the applicable Nigerian law, employee exemptions and employer payroll policy before production use. Update `TAX_BANDS` and the deduction rates at the top of `app.js` when the policy is confirmed.

## Gross composition

Enter the percentage for each earnings category. The calculator shows the live allocation total and only calculates when the percentages add up to exactly 100%. The result then shows the naira value of each category based on the entered gross salary. The default example is 50% Basic, 20% Housing, 15% Transport and 15% Other Allowances; replace these with the company's approved payroll structure.

For the current payroll rule, employee pension is calculated at 8% of Basic + Housing + Transport. NHF is calculated at 2.5% of Basic salary only. The on-screen deduction descriptions reflect these bases.
