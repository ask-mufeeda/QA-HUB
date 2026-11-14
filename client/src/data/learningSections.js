export const learningSections = [
  {
    id: "manual-testing",
    number: "01",
    title: "Manual testing",
    description:
      "Learn how to plan, design, execute, and communicate software tests with confidence.",
    lessons: [
      {
        id: "manual-sdlc-stlc",
        title: "SDLC and STLC",
        explanation:
          "The Software Development Life Cycle (SDLC) describes how a product is planned, built, released, and maintained. The Software Testing Life Cycle (STLC) is the testing work within that process: analyze requirements, plan tests, design cases, prepare the environment, execute, and close testing.",
        example:
          "A team reviews a checkout requirement (analysis), estimates test effort (planning), writes payment and shipping cases (design), prepares a test account (setup), runs the cases (execution), then reports coverage and remaining risks (closure).",
        exercise: {
          prompt:
            "A tester is writing test cases after reviewing a new requirement. Which STLC activity is this?",
          answer:
            "Test design. Requirement analysis has already happened; the tester is turning requirements into test conditions and cases.",
        },
        interview: {
          question: "How are SDLC and STLC related?",
          answer:
            "SDLC covers the full product-development process. STLC is the structured set of testing activities that supports quality throughout that process, often overlapping development phases rather than starting only after coding.",
        },
      },
      {
        id: "manual-scenarios-cases",
        title: "Test scenarios and test cases",
        explanation:
          "A test scenario is a high-level statement of what needs testing. A test case makes that scenario repeatable by specifying preconditions, test data, steps, and an observable expected result. Clear cases help another person reproduce the same check.",
        example:
          "Scenario: verify a user can sign in. Case: start signed out, enter a registered email and valid password, select Sign in, and expect the account dashboard to appear.",
        exercise: {
          prompt:
            "Write one test case for an invalid password. Include the action and an expected result.",
          answer:
            "Enter a registered email and an incorrect password, then select Sign in. Expected: authentication is rejected, a helpful error is shown, and the user remains signed out.",
        },
        interview: {
          question: "What information makes a test case useful?",
          answer:
            "A clear title, preconditions, test data, ordered steps, expected result, and an identifier or trace to the requirement. The steps should be specific enough to repeat without guessing.",
        },
      },
      {
        id: "manual-test-design",
        title: "Test design techniques",
        explanation:
          "Test design techniques help select a small but useful set of checks. Equivalence partitioning groups inputs expected to behave alike; boundary-value analysis targets edges; decision tables cover combinations of rules; state-transition testing checks behavior as an item changes state.",
        example:
          "For an allowed quantity of 1–10, boundary-value checks include 0, 1, 2, 9, 10, and 11. These focus on the edges where off-by-one defects often occur.",
        exercise: {
          prompt:
            "A field accepts values from 18 through 60 inclusive. Give four boundary-focused values to test.",
          answer:
            "17 and 18 test the lower boundary; 60 and 61 test the upper boundary.",
        },
        interview: {
          question: "When would you use equivalence partitioning?",
          answer:
            "When the input domain can be divided into groups expected to have the same behavior. Testing representative values from valid and invalid groups reduces redundant cases while preserving useful coverage.",
        },
      },
      {
        id: "manual-bug-life-cycle",
        title: "Bug life cycle",
        explanation:
          "A defect moves through agreed team states so its ownership and outcome are visible. A common flow is New, Triaged, Assigned, In Progress, Fixed, Ready for Retest, and Closed. A failed retest can move it to Reopened; exact names vary by team.",
        example:
          "A tester reports that checkout charges twice. The team reproduces and assigns it, a developer fixes the payment handling, and the tester retries the same steps before closing the report.",
        exercise: {
          prompt:
            "A developer marks a defect Fixed, but the tester can still reproduce it. What should happen next?",
          answer:
            "Record the failed retest with evidence and move the defect to Reopened (or the team's equivalent state), then return it for investigation.",
        },
        interview: {
          question: "Why should a tester retest a fixed bug?",
          answer:
            "To confirm the reported behavior is corrected in the target build and that the fix did not introduce a related regression. A status change alone is not proof of a working fix.",
        },
      },
      {
        id: "manual-severity-priority",
        title: "Severity vs. priority",
        explanation:
          "Severity describes the impact of a defect on the product or users. Priority describes how soon the team should address it. They are related but not identical: a severe issue may affect a rarely used feature, while a lower-impact issue may be urgent because of a deadline or visibility.",
        example:
          "A crash that blocks every purchase is high severity and high priority. A typo on a high-traffic launch page may have low severity but high priority for the release.",
        exercise: {
          prompt:
            "A typo appears on a rarely visited internal page and does not block work. Which is likely lower: severity, priority, or both?",
          answer:
            "Severity is low because functionality is unaffected; priority is also likely low unless a deadline or business requirement makes it urgent.",
        },
        interview: {
          question: "Who decides a bug's priority?",
          answer:
            "It is usually agreed by the product or triage team with input from engineering and QA, using impact, user reach, risk, deadlines, and dependencies. QA provides evidence but does not determine priority in isolation.",
        },
      },
      {
        id: "manual-exploratory",
        title: "Exploratory testing",
        explanation:
          "Exploratory testing combines learning, test design, and execution. Instead of following only a fixed script, the tester investigates a feature, adapts checks based on observations, and records findings. A focused charter and timebox keep the exploration purposeful.",
        example:
          "Charter: explore password reset for confusing states. Try unknown addresses, expired links, repeated submissions, and switching devices; note the exact steps and evidence for any surprising result.",
        exercise: {
          prompt:
            "Write a short exploratory charter for a search box that supports filters.",
          answer:
            "Example: explore search and filters for inconsistent or confusing results, including empty queries, special characters, rapid filter changes, and clearing all filters within a 20-minute timebox.",
        },
        interview: {
          question: "How do you make exploratory testing reproducible?",
          answer:
            "Record the charter, environment, data, actions, observations, and evidence. Exploratory work is flexible, but useful findings still need enough detail for another person to reproduce them.",
        },
      },
    ],
  },
  {
    id: "api-testing",
    number: "02",
    title: "API testing",
    description:
      "Understand HTTP requests and responses, then practise checking API behavior with Postman-style workflows.",
    lessons: [
      {
        id: "api-introduction",
        title: "Introduction to APIs",
        explanation:
          "An API is a defined way for software systems to exchange requests and responses. A client sends a request to an endpoint; the server applies rules and returns a status, headers, and often a body. API testing checks that contract without relying on the user interface.",
        example:
          "GET https://api.example.test/users/42 asks the service for user 42. A successful response might have status 200 and a JSON object containing that user's fields.",
        exercise: {
          prompt:
            "In `GET /orders/12`, identify the HTTP method and the resource being requested.",
          answer:
            "The method is GET. The client is requesting the order identified by 12 from the orders resource.",
        },
        interview: {
          question: "Why test an API separately from the user interface?",
          answer:
            "API tests can check service rules, data, and error handling directly and often earlier than UI tests. They provide focused feedback, though they do not replace end-to-end checks of the complete user journey.",
        },
      },
      {
        id: "api-http-methods",
        title: "HTTP methods",
        explanation:
          "HTTP methods describe the intended action. GET retrieves data, POST submits or creates data, PUT replaces a resource, PATCH updates selected fields, and DELETE requests removal. The server's actual behavior should match its documented contract.",
        example:
          "GET /products/8 reads a product. PATCH /products/8 with `{\"price\":19.99}` changes one field. PUT commonly sends the complete replacement representation.",
        exercise: {
          prompt:
            "Choose a method to create a new support ticket, then choose one to change only its status.",
          answer:
            "POST is commonly used to create the ticket. PATCH is commonly used to update only the status; verify the specific API contract because implementations can differ.",
        },
        interview: {
          question: "What is the practical difference between PUT and PATCH?",
          answer:
            "PUT generally replaces a resource representation, while PATCH applies a partial modification. Clients should follow the API's documented semantics and required fields.",
        },
      },
      {
        id: "api-status-codes",
        title: "Status codes",
        explanation:
          "The status code summarizes the outcome of an HTTP request. 2xx indicates success, 3xx redirection, 4xx a client-side issue such as invalid input or missing access, and 5xx a server-side failure. Check the exact code expected for each API operation.",
        example:
          "A common pattern is 200 for a successful read, 201 for a created resource, 400 for invalid input, 401 for missing or invalid authentication, 404 for a missing resource, and 500 for an unexpected server failure.",
        exercise: {
          prompt:
            "An API accepts a valid create request and returns the new item. Which status is commonly used, and what does 401 mean?",
          answer:
            "201 Created is commonly used for successful creation. 401 Unauthorized indicates authentication is missing or invalid; it does not by itself mean the authenticated user lacks permission.",
        },
        interview: {
          question: "How do 401 and 403 differ?",
          answer:
            "401 means valid authentication is absent or not accepted. 403 means the request is understood but the authenticated caller is not allowed to perform it.",
        },
      },
      {
        id: "api-request-headers",
        title: "Request headers",
        explanation:
          "Headers carry metadata about a request. Content-Type describes the format of the body being sent; Accept describes formats the client can handle. Authorization can carry credentials, such as a bearer token. Send only headers required by the API and keep secrets out of shared screenshots and public repositories.",
        example:
          "Content-Type: application/json\nAccept: application/json\nAuthorization: Bearer <your-authorized-token>",
        exercise: {
          prompt:
            "You send a JSON body and want JSON back. Which two content-negotiation headers are commonly useful?",
          answer:
            "Content-Type: application/json describes the request body. Accept: application/json asks for a JSON response when the API supports it.",
        },
        interview: {
          question: "What is the difference between Content-Type and Accept?",
          answer:
            "Content-Type describes the media type of the body sent with the request. Accept lists response media types the client is willing to receive.",
        },
      },
      {
        id: "api-json-body",
        title: "JSON request bodies",
        explanation:
          "A JSON request body represents data with objects, arrays, strings, numbers, booleans, and null. Object keys and string values use double quotes. The request usually needs Content-Type: application/json, and required fields and data types must follow the API schema.",
        example:
          "{\n  \"email\": \"qa@example.test\",\n  \"active\": true,\n  \"roles\": [\"tester\"]\n}",
        exercise: {
          prompt:
            "Fix this invalid JSON body: `{name: 'Mina', active: True}`.",
          answer:
            "Use double-quoted keys and strings, and lowercase JSON booleans: `{\"name\":\"Mina\",\"active\":true}`.",
        },
        interview: {
          question: "What should you verify when testing a JSON request body?",
          answer:
            "Check required and optional fields, types, allowed values, nullability, nested structures, boundary values, and how the API responds to missing or malformed data.",
        },
      },
      {
        id: "api-response-validation",
        title: "Response validation",
        explanation:
          "A useful API check validates more than whether a response arrived. Verify the expected status, required headers, body schema and data types, important values, and response time. Include negative cases so invalid requests produce clear and safe errors.",
        example:
          "For a user lookup, check status 200, a JSON content type, a numeric `id`, a string `email`, and that the returned id matches the requested user.",
        exercise: {
          prompt:
            "An endpoint should return a list of products. Name two checks beyond status 200.",
          answer:
            "For example, verify the response is a JSON array and each item has a string name and numeric id. Also check required headers or that each returned item matches the requested filter.",
        },
        interview: {
          question: "How would you test an API response schema?",
          answer:
            "Check that required fields exist and have the expected types and constraints, including nested objects and arrays. Include missing, null, and unexpected-field cases as required by the contract.",
        },
      },
      {
        id: "api-postman-practice",
        title: "Postman practical exercises",
        explanation:
          "Postman is a client for composing HTTP requests and inspecting responses. Start with a public, non-sensitive endpoint, choose a method, add parameters or headers, send the request, and compare the actual response with the API's documented contract.",
        example:
          "GET https://jsonplaceholder.typicode.com/posts/1\n\nThen try POST https://httpbin.org/anything with a JSON body. httpbin echoes the request it received, making it useful for practising request construction.",
        exercise: {
          prompt:
            "In Postman, send GET `https://jsonplaceholder.typicode.com/posts/1`. Check the status, JSON body, and response time. What fields do you see?",
          answer:
            "The public test endpoint commonly returns a post object with numeric `userId` and `id`, plus string `title` and `body`. Confirm the actual response rather than assuming it.",
        },
        interview: {
          question: "How do you make a Postman request reusable without exposing secrets?",
          answer:
            "Use an appropriately scoped environment variable for credentials, avoid committing exported secrets, restrict access to the environment, and rotate any token that is accidentally exposed. Do not store production credentials in a shared or public workspace.",
        },
      },
    ],
  },
  {
    id: "sql",
    number: "03",
    title: "SQL",
    description:
      "Use SQL to inspect related records and check that application data is correct.",
    lessons: [
      {
        id: "sql-select-where-order",
        title: "SELECT, WHERE, and ORDER BY",
        explanation:
          "SELECT chooses columns, WHERE filters rows, and ORDER BY sorts the result. Add a stable key as a final sort when repeatable ordering matters. In QA, these clauses help isolate records and inspect test outcomes.",
        example:
          "SELECT id, title, status\nFROM bugs\nWHERE status = 'Open'\nORDER BY id;",
        exercise: {
          prompt:
            "Write a query to return the email addresses of confirmed signups, ordered alphabetically.",
          answer:
            "SELECT email FROM signups WHERE confirmed = 1 ORDER BY email;",
        },
        interview: {
          question: "What is the difference between WHERE and ORDER BY?",
          answer:
            "WHERE filters which rows are returned. ORDER BY sorts the rows that remain; it does not filter them.",
        },
      },
      {
        id: "sql-group-having",
        title: "GROUP BY and HAVING",
        explanation:
          "GROUP BY combines rows that share values so aggregate functions such as COUNT or AVG can summarize each group. WHERE filters source rows before grouping; HAVING filters the groups after aggregation.",
        example:
          "SELECT status, COUNT(*) AS bug_count\nFROM bugs\nGROUP BY status\nHAVING COUNT(*) > 1\nORDER BY status;",
        exercise: {
          prompt:
            "Count bugs in each status and show only statuses with at least two bugs.",
          answer:
            "SELECT status, COUNT(*) AS bug_count FROM bugs GROUP BY status HAVING COUNT(*) >= 2;",
        },
        interview: {
          question: "When should you use HAVING instead of WHERE?",
          answer:
            "Use HAVING to filter groups using aggregate results, such as COUNT(*) > 1. Use WHERE to filter individual rows before the grouping and aggregation step.",
        },
      },
      {
        id: "sql-joins",
        title: "JOINs",
        explanation:
          "A JOIN combines rows from related tables using a matching condition. INNER JOIN keeps only matching rows; LEFT JOIN keeps every row from the left table and fills unmatched right-side columns with NULL. Check the join key to avoid accidental row multiplication.",
        example:
          "SELECT test_cases.title, users.name\nFROM test_cases\nJOIN users ON users.id = test_cases.tester_id\nORDER BY test_cases.id;",
        exercise: {
          prompt:
            "Which join keeps every test case even when its tester record is missing?",
          answer:
            "A LEFT JOIN with test_cases on the left keeps every test case and returns NULL for user columns when no tester row matches.",
        },
        interview: {
          question: "How can an incorrect JOIN create duplicate results?",
          answer:
            "If the join condition is missing or matches multiple rows on the other side, each matching combination is returned. Verify key uniqueness and join predicates, then compare row counts before and after the join.",
        },
      },
      {
        id: "sql-subqueries",
        title: "Subqueries",
        explanation:
          "A subquery is a query nested inside another query. It can produce a value, a set of values, or a temporary result used by the outer query. EXISTS is useful when you only need to know whether a related row exists.",
        example:
          "SELECT name\nFROM users\nWHERE id IN (\n  SELECT tester_id FROM test_cases WHERE status = 'Fail'\n);",
        exercise: {
          prompt:
            "Find users who have at least one test case with status Fail using a subquery.",
          answer:
            "SELECT name FROM users WHERE id IN (SELECT tester_id FROM test_cases WHERE status = 'Fail');",
        },
        interview: {
          question: "When might EXISTS be preferable to IN?",
          answer:
            "EXISTS expresses that a matching row must exist and can be clear for correlated checks. Query planners often optimize either form, so use the form that best expresses the relationship and verify performance on real data.",
        },
      },
      {
        id: "sql-data-validation",
        title: "Data validation exercises",
        explanation:
          "QA data checks compare stored values with business rules and related records. Look for missing values, duplicates, invalid ranges, inconsistent status transitions, and broken relationships. Choose a query that reports evidence rather than silently altering data.",
        example:
          "SELECT email, COUNT(*) AS copies\nFROM signups\nGROUP BY email\nHAVING COUNT(*) > 1;",
        exercise: {
          prompt:
            "Write a query to find test cases whose tester_id does not match any user id.",
          answer:
            "SELECT test_cases.id, test_cases.title FROM test_cases LEFT JOIN users ON users.id = test_cases.tester_id WHERE users.id IS NULL;",
        },
        interview: {
          question: "How would you validate that related data is consistent?",
          answer:
            "Identify the relationship and expected constraints, then query for orphaned foreign keys, duplicates, invalid ranges, or mismatched aggregates. Confirm the result against the requirement and use controlled data for any corrective test.",
        },
      },
    ],
  },
  {
    id: "automation-testing",
    number: "04",
    title: "Automation testing",
    description:
      "Start with Java and learn how Selenium scripts locate, wait for, and verify web application behavior.",
    lessons: [
      {
        id: "automation-java-basics",
        title: "Java basics for testers",
        explanation:
          "Java automation scripts use the same building blocks as other Java programs: variables hold values, types describe them, conditions choose behavior, loops repeat work, and methods organize reusable actions. Start with small, readable methods rather than building a large framework immediately.",
        example:
          "String expectedTitle = \"QA Hub\";\nboolean titleMatches = expectedTitle.equals(\"QA Hub\");\nif (titleMatches) {\n    System.out.println(\"Title is correct\");\n}",
        exercise: {
          prompt:
            "Declare an integer named `retryCount` with value 3, then write a condition that checks it is greater than 0.",
          answer:
            "Use `int retryCount = 3;` and `if (retryCount > 0) { ... }`. Java uses braces for the condition's block.",
        },
        interview: {
          question: "Why should Java strings usually be compared with equals rather than ==?",
          answer:
            "`equals` compares string contents. `==` compares whether two references point to the same object, which is not the usual question when checking text.",
        },
      },
      {
        id: "automation-selenium-intro",
        title: "Selenium introduction",
        explanation:
          "Selenium WebDriver automates browser actions through a driver. A test can open a page, locate elements, interact with them, and inspect results. Keep setup and cleanup reliable so a failed assertion does not leave browser processes running.",
        example:
          "WebDriver driver = new ChromeDriver();\ntry {\n    driver.get(\"https://example.test\");\n} finally {\n    driver.quit();\n}",
        exercise: {
          prompt:
            "Which WebDriver call opens a page, and which call closes the browser session?",
          answer:
            "`driver.get(url)` opens the page. `driver.quit()` closes the browser session and its associated windows.",
        },
        interview: {
          question: "What is the role of WebDriver in Selenium?",
          answer:
            "WebDriver provides the API that sends browser-control commands through the relevant driver, allowing tests to navigate, interact with elements, and inspect browser state.",
        },
      },
      {
        id: "automation-locators",
        title: "Locators",
        explanation:
          "A locator identifies an element in the page. Prefer stable, unique identifiers such as an element id or an agreed test attribute. CSS selectors can be useful; long selectors tied to layout or generated class names are often brittle.",
        example:
          "WebElement email = driver.findElement(By.id(\"email\"));\nemail.sendKeys(\"qa@example.test\");",
        exercise: {
          prompt:
            "A submit button has `id=\"submit-order\"`. Write the Selenium locator expression to find it.",
          answer:
            "`driver.findElement(By.id(\"submit-order\"))` locates the element by its stable id.",
        },
        interview: {
          question: "What makes a locator reliable?",
          answer:
            "It is unique, stable across expected UI changes, and expresses the element's purpose. Prefer developer-supported ids or test attributes over selectors based on incidental layout.",
        },
      },
      {
        id: "automation-waits",
        title: "Waits",
        explanation:
          "Web pages update asynchronously, so an element may not be ready immediately. An explicit wait polls for a meaningful condition, such as visibility or clickability, until a timeout. Avoid using fixed sleeps as a general synchronization strategy because they are either wasteful or too short.",
        example:
          "WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));\nWebElement button = wait.until(\n    ExpectedConditions.elementToBeClickable(By.id(\"submit\"))\n);",
        exercise: {
          prompt:
            "A confirmation message appears after saving. What should an explicit wait check before the test reads it?",
          answer:
            "Wait until the confirmation element is visible (and, if needed, contains the expected text) before reading it.",
        },
        interview: {
          question: "Why are explicit waits usually better than Thread.sleep?",
          answer:
            "Explicit waits poll for the required condition and continue as soon as it is met, while a fixed sleep always waits the full duration and can still fail if the page takes longer.",
        },
      },
      {
        id: "automation-assertions",
        title: "Assertions",
        explanation:
          "An assertion compares actual behavior with an expected result. A failed assertion marks the test as failed and provides a useful diagnostic. Assert observable outcomes such as a confirmation message, URL, or saved value rather than only checking that an action did not throw an exception.",
        example:
          "Assertions.assertEquals(\"Order confirmed\", confirmationHeading.getText());\nAssertions.assertTrue(orderNumber.isDisplayed());",
        exercise: {
          prompt:
            "A test expects the page title to be `Orders`. Write a JUnit-style equality assertion.",
          answer:
            "`Assertions.assertEquals(\"Orders\", driver.getTitle());` compares the expected title with the actual browser title.",
        },
        interview: {
          question: "What is the difference between an assertion and a wait?",
          answer:
            "A wait synchronizes the test with an asynchronous condition. An assertion verifies that the observed result matches the requirement; a wait completing does not automatically prove the result is correct.",
        },
      },
      {
        id: "automation-basic-script",
        title: "Write a basic automation script",
        explanation:
          "A focused UI test follows Arrange, Act, Assert: open a known state, perform one user action, then verify a meaningful outcome. Use stable test data, clear locators, explicit waits, and guaranteed cleanup. Keep each test focused so failures are easier to diagnose.",
        example:
          "@Test\nvoid signInShowsTheAccountHeading() {\n    driver.get(baseUrl + \"/login\");\n    driver.findElement(By.id(\"email\")).sendKeys(testEmail);\n    driver.findElement(By.id(\"password\")).sendKeys(testPassword);\n    driver.findElement(By.id(\"sign-in\")).click();\n\n    WebElement heading = wait.until(\n        ExpectedConditions.visibilityOfElementLocated(By.id(\"account-heading\"))\n    );\n    Assertions.assertEquals(\"My account\", heading.getText());\n}",
        exercise: {
          prompt:
            "Outline one Arrange, Act, Assert check for adding an item to a cart.",
          answer:
            "Arrange: open a product with known stock. Act: select Add to cart. Assert: wait for the cart count to increase and verify the correct product is listed.",
        },
        interview: {
          question: "What helps prevent automated UI tests from becoming flaky?",
          answer:
            "Use isolated and repeatable test data, stable locators, condition-based waits, independent tests, meaningful assertions, and reliable cleanup. Diagnose environment and product timing rather than hiding failures with long sleeps or retries.",
        },
      },
    ],
  },
];
