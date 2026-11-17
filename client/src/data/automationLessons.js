export const automationGlossary = [
  {
    term: "Test",
    definition: "A check that asks, 'Did the app do the right thing?'",
  },
  {
    term: "Assertion",
    definition: "A rule that says what should happen, like 'the page should show Buy milk'.",
  },
  {
    term: "Locator",
    definition: "A way to find a button, field, or text on the page.",
  },
  {
    term: "Report",
    definition: "A file that shows which tests passed, failed, and how long they took.",
  },
  {
    term: "Flaky",
    definition: "A test that sometimes passes and sometimes fails without a real app change.",
  },
];

export const automationLessons = [
  {
    id: "automation-lesson-1",
    title: "What is automation testing?",
    whatYouWillLearn: "You will learn what automation testing is and when it helps.",
    explanation: [
      "Manual testing means a person clicks through the app and checks the result. Automation testing means a computer does the same checks for us.",
      "Think about a shop checkout. A person can check one order by hand. A computer can check many orders very fast. That saves time when the same checks happen again and again.",
      "Automation is useful for repeat checks, smoke tests, and large test runs. It is not always worth it for one small screen or a brand new feature that changes often.",
    ],
    steps: [
      "Think of one task you do again and again in QA.",
      "Ask, 'Would I want a computer to do this check 20 times?'",
      "If the answer is yes, automation is a good fit.",
    ],
    commands: [],
    whatYouShouldSee: "You should see the idea: automation is a repeatable check, not a replacement for every human check.",
    commonProblems: [
      "Thinking automation must replace all manual testing. It does not.",
      "Choosing automation for a feature that changes every day. That is often too early.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "If you are unsure, start with a small check. Pick one task you do again and again. That is a good first automation test.",
    },
  },
  {
    id: "automation-lesson-2",
    title: "Install Playwright",
    whatYouWillLearn: "You will learn how to install Playwright and set up a simple test project.",
    explanation: [
      "Node.js is the tool that runs JavaScript on your computer. Check whether it is installed by typing node -v in a terminal.",
      "If you see a version number, you are ready. If not, install Node.js from nodejs.org and try again.",
      "Then make a new folder and run the Playwright setup command. The setup asks a few questions. The default answers are fine for a first test project.",
    ],
    steps: [
      "Open a terminal and type: mkdir my-first-tests",
      "Then type: cd my-first-tests",
      "Then type: npm init playwright@latest",
      "When it asks, answer: TypeScript = No, tests folder = Yes, GitHub Actions = No, install browsers = Yes.",
    ],
    commands: [
      { label: "Check Node.js", command: "node -v" },
      { label: "Create a folder", command: "mkdir my-first-tests" },
      { label: "Open the folder", command: "cd my-first-tests" },
      { label: "Install Playwright", command: "npm init playwright@latest" },
    ],
    whatYouShouldSee: "You should see a project folder with a tests folder, Playwright config, and browser downloads.",
    commonProblems: [
      "Node.js is not installed or the version is old. Install Node.js and try again.",
      "You ran the command in the wrong folder. Check that you are inside my-first-tests.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "If the setup stops, read the last line of the error. It usually tells you what is missing, such as Node.js or permission to install files.",
    },
  },
  {
    id: "automation-lesson-3",
    title: "Run your first test",
    whatYouWillLearn: "You will learn how to run a test and read the result summary.",
    explanation: [
      "A test is a small set of steps. It opens a page, does an action, and checks the result.",
      "When Playwright runs a test, it shows passed, failed, skipped, and how long it took. Passed means the app matched the check. Failed means the result did not match.",
      "The HTML report is a page that shows the test result in a nicer way. It is useful when you need to inspect a failure.",
    ],
    steps: [
      "Run: npx playwright test",
      "Look for the summary at the end.",
      "Open the report with: npx playwright show-report",
    ],
    commands: [
      { label: "Run tests", command: "npx playwright test" },
      { label: "Open report", command: "npx playwright show-report" },
    ],
    whatYouShouldSee: "You should see a summary such as 1 passed or 1 failed, plus the time it took to run.",
    commonProblems: [
      "The browser is not installed. Re-run the setup and install browsers.",
      "The test file is not in the tests folder. Put it there before running it.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "Read the last error line. If the error says browser missing, install browsers again. If it says page not found, check the URL and the page name.",
    },
  },
  {
    id: "automation-lesson-4",
    title: "Read a test file",
    whatYouWillLearn: "You will learn the basic parts of a Playwright test and how a test checks the page.",
    explanation: [
      "A test file contains steps. The browser opens a page with page.goto. A locator finds the field or button. The code fills in the text and presses Enter.",
      "The expect line is the check. It says, 'This text should appear'. If the page does not show it, the test fails.",
      "The demo site https://demo.playwright.dev/todomvc is a simple todo app. It is great for learning because it is easy to see what is happening.",
    ],
    steps: [
      "Open the demo page.",
      "Find the input box with the placeholder text 'What needs to be done?'.",
      "Type Buy milk and press Enter.",
      "Check that the new task appears on the page.",
      "Change the text to something else and then break the expected text on purpose to see a failure.",
    ],
    commands: [
      {
        label: "Example test",
        command: `import { test, expect } from '@playwright/test';

test('add a todo', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await page.getByPlaceholder('What needs to be done?').fill('Buy milk');
  await page.getByPlaceholder('What needs to be done?').press('Enter');
  await expect(page.getByText('Buy milk')).toBeVisible();
});`,
      },
    ],
    whatYouShouldSee: "You should see a new todo item called Buy milk, and then a failing test if the expected text is misspelled.",
    commonProblems: [
      "The page is not ready yet. Wait for the page to load before checking the text.",
      "The text is slightly different. Check spelling, spaces, and casing.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "If the test fails, read the message. It often tells you the actual text and the expected text, so you can compare them.",
    },
  },
  {
    id: "automation-lesson-5",
    title: "Record a test with codegen",
    whatYouWillLearn: "You will learn how to record a browser action and turn it into test code.",
    explanation: [
      "Codegen is a helper that records your clicks and types. It turns those steps into code for you.",
      "This is useful when you want to learn the syntax or make a first test fast. It is not a replacement for reading the test later.",
      "The recorder opens a browser window. You click around and it writes the steps into code.",
    ],
    steps: [
      "Run: npx playwright codegen https://demo.playwright.dev/todomvc",
      "A browser window opens.",
      "Type a todo, then stop the recording.",
      "Copy the generated code into a new test file and run it.",
    ],
    commands: [
      { label: "Record a test", command: "npx playwright codegen https://demo.playwright.dev/todomvc" },
    ],
    whatYouShouldSee: "You should see the recorder window, then a generated test file that matches your clicks.",
    commonProblems: [
      "The browser is not installed. Re-run the Playwright setup and install browsers.",
      "The generated test uses too much code. It is okay. You can clean it up later.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "If codegen does not open, check that you are in the right folder and that the browser was installed during setup.",
    },
  },
  {
    id: "automation-lesson-6",
    title: "Make a report and import it into QA Hub",
    whatYouWillLearn: "You will learn how to save a test report and send it to QA Hub for review.",
    explanation: [
      "A report is a file that records the test result. JSON is a simple format that is easy to read by a computer.",
      "The command below saves the test report as report.json. Then you can open QA Hub, go to the Results tab, and import that file.",
      "When a test fails, the error message is saved. In QA Hub, you can use Create bug to open the bug form with the failure already filled in.",
    ],
    steps: [
      "Run: npx playwright test --reporter=json > report.json",
      "Open QA Hub and go to Automation testing.",
      "Click Import results and choose the JSON file.",
      "Review the failed checks and use Create bug for any real problem.",
    ],
    commands: [
      { label: "Create JSON report", command: "npx playwright test --reporter=json > report.json" },
    ],
    whatYouShouldSee: "You should see a saved report.json file and then the same results appear in the QA Hub results dashboard.",
    commonProblems: [
      "The file was not created. Check the folder and make sure the command ran from the project folder.",
      "The import fails. Make sure the file contains valid JSON and not an empty folder.",
    ],
    stuck: {
      title: "Most likely problem",
      fix: "If the file is empty or the import does not work, run the Playwright test again and check the terminal output before importing.",
    },
    callToAction: "Go to Import results",
  },
];
