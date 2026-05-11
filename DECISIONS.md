# The Affordability Assessment

### Financial Health Status

A quick view widget that shows the customer their financial health status for a month, giving them a clear reflection of their financial position and how well they are doing with their finances. As our users are vulnerable customers who may already be in a stressful situation, instead of presenting financial health with breakdowns, numbers, interactive charts and graphs, a simple widget with a colour indicator is easier to process and more appropriate — it avoids making an already difficult situation feel more overwhelming.

Health status colour:

- 🟢 Green — customer is doing well
- 🟡 Amber — finances are under pressure
- 🔴 Red — needs urgent help

2 possible formulas to calculate financial health status:

#### `1. Simple Approach (although I appreciate that no approach is truly simple)`

Calculate the Debt-to-Income (DTI) ratio using the following formula:

```
DTI = total expenditure / income
```

Then determine the financial health indicator based on the result.

Example — for someone with the following financial records:

```
Income:             £2,800
Rent:               £900
Food:               £400
Travel:             £150
Loan repayment:     £1,000
Netflix:            £15

=================================

Total expenditure:  £2,465
DTI: £2,465 / £2,800 = 88% → Red
```

Based on the DTI, we can set the indicator as follows:

```
20%  — Comfortable, debt is manageable              🟢
40%  — Under pressure, limited flexibility          🟢
60%  — Serious, most income is committed            🟡
80%  — Critical, very little left for anything else 🔴
100%+ — Debt repayments alone exceed income         🔴
```

**The downside of this approach**

It takes every single outgoing — rent, food, Netflix, loan repayment — adds them all together and divides by income. One number. No distinction between any of them.

Take this customer for instance:

```
Income:            £2,800
Rent:              £900
Food:              £400
Travel:            £150
Loan repayment:    £1,000
Netflix:           £15

Total expenditure: £2,465
DTI: £2,465 / £2,800 = 88% → Red
```

It tells the customer nothing useful because it cannot distinguish between:

- Things they cannot change — rent, food, travel
- Things they must pay — loan repayment
- Things they could reduce — Netflix

Netflix is being weighted the same as the loan repayment. A £15 subscription is dragging the rating down the same way a £1,000 debt obligation does. That is wrong.


#### `2. Smarter Approach — splitting expenditure into 3 buckets`

Expenditure categorisation:

```
Essential spend   — rent, utilities, food, travel (non-negotiable)
Debt repayments   — loan repayments, credit card minimums
Discretionary     — everything else (negotiable)
```

Then calculate:

```
Surplus after essentials = income − essential spend
                         = £2,800 − £1,450
                         = £1,350

Headroom = surplus after essentials − debt repayments
         = £1,350 − £1,000
         = £350

Headroom ratio = headroom / income
               = £350 / £2,800
               = 12.5%
```

Then the rating:

| Condition | Status | Meaning |
|---|---|---|
| Income = 0 or essentials > income | 🔴 Red | Cannot cover basic needs |
| Headroom ≤ 0 | 🔴 Red | Cannot afford debt repayments after essentials |
| Headroom ratio < 10% | 🔴 Red | Technically affordable but dangerously tight |
| Headroom ratio 10–20% | 🟡 Amber | Manageable but limited buffer |
| Headroom ratio > 20% | 🟢 Green | Comfortable, meaningful buffer exists |

So for our customer:

```
Headroom ratio = 12.5% → Amber
```

That is a much more honest and useful rating. The customer can afford their debt repayment. They are not in crisis. They just have limited flexibility — which is exactly what Amber means.

**How do we split expenditure into 3 buckets?**

For our system to know which bucket an expenditure belongs to, we need a database column for bucket type (e.g. an enum column with possible values: `essential`, `debt-repayment` and `discretionary`). But if we ask the customer to explicitly select the bucket when logging an expenditure, that would not be a good user experience.

We can leverage an LLM to solve this problem. When an expenditure is logged into our system, before it is saved to the database, we use an LLM to classify whether it is essential, discretionary or a debt repayment. This introduces an additional layer of complexity in the implementation, but it means a customer who is already under financial stress has the best possible experience using our app.

For this exercise, it is assumed that the functionality to log income and expenditure is already implemented and that expenditure records are already categorised. This feature is therefore scoped out. If I had more time, this is how I would approach it: use a smaller LLM model to keep costs low, use few-shot prompting by embedding concrete examples in the prompt, and set a low temperature value to make the model more deterministic.


### Monthly Money Breakdown Widget

The financial health status widget tells the customer how they are doing for a specific month, but it does not show a breakdown of how their money is spent or offer any advice that could help them pay off their debt sooner.

This widget provides a visual breakdown of the customer's money into four categories: income, essential bills, debt repayment and discretionary spend.

The LLM then analyses the full picture and does two things:

**1. Repayment affordability insight** — based on the customer's headroom, the LLM tells them whether their current repayment is affordable, whether they could increase it, and by how much. For example:

> *"Based on what you have left over, you could afford to increase your loan repayment by around £85 a month without putting your essentials at risk. Even a small increase would help you clear it sooner. If that still feels unmanageable, a free debt adviser may be able to negotiate a lower amount on your behalf."*

This directly addresses whether repayment options are realistic — without needing to know the total debt owed.

**2. Discretionary spend suggestions** — because expenditure is already categorised into buckets, the LLM can identify specific discretionary items worth reducing and generate an inline suggestion for each one. For example:

> *"Netflix £15, Spotify £9, Disney+ £8 — you have 3 streaming subscriptions totalling £32. Could you cut one?"*

> *"Cutting Deliveroo by half would save you £75 a month — £900 over the year."*

These suggestions are specific to the customer's actual data, not generic advice. The language used throughout is plain English, warm and non-judgmental — appropriate for customers who may already be in financial difficulty.


## Progress Over Time Widget

So far, the features built help the customer understand their financial position for a given month. There is no way to track whether things are getting better or worse over time. This widget addresses that directly.

Rather than introducing a separate snapshots table, this widget queries the existing `financial_records` table and groups records by month. This means no new data needs to be stored — the existing historical records already contain everything needed to show the trend.

The progress score for each month is calculated as follows:

```
progress = (disposable_income - min_disposable_income)
           / (max_disposable_income - min_disposable_income)
           × 100
```

Where min and max are the lowest and highest disposable income values across all months in the current window. This means the best month always scores 100 and the worst always scores 0 — so the customer can see their journey clearly, not an abstract ratio.

Edge cases:
- If all months have the same disposable income, return 50 for all periods (position is stable)
- If there is only one month in the window, return 100 if disposable income is positive, 0 if zero or negative

### Problems addressed

This widget, combined with the features above, means the product can now answer all three problems from the brief:

- Reflection of their financial position — addressed by the financial health status widget and monthly breakdown
- A way to track whether things are getting better or worse — addressed by this widget
- Whether their repayment options are realistic — addressed by the LLM repayment affordability insight in the monthly breakdown


# Tech Stack

## Front-end and back-end frameworks

- **First choice: Pure React.js (frontend only)**
  - Issue: While pragmatic for the assessment, this treats the exercise more like a coding test than a real-world project. Storing data in localStorage and performing calculations on the client side is poor practice from both a security and data confidentiality perspective.

- **Second choice: Next.js without a dedicated backend API**
  - Issue: SEO is not a requirement for this application. Using Next.js would introduce unnecessary server-side rendering overhead and potentially higher hosting costs without providing meaningful benefits for this use case.

- **Final decision: React.js (SPA) + dedicated API**
  - Evaluated serverless and serverful (Express.js) options.
  - In a real-world production environment, a serverless API would likely be more suitable. However, it would make local development and testing more difficult. Express.js was chosen for this reason.


## Database

### SQL vs NoSQL

We are storing financial data belonging to vulnerable customers in an FCA-regulated environment. ACID compliance is essential — saving a record and its associated data must be atomic, so the database is never left in a partially valid state.

Data integrity is equally important. Income and expenditure items should not exist without a valid user. The foreign key and primary key constraints that come with a relational database enforce this at the database level, not just in application code — which is the right place for that guarantee in a regulated context.

When it comes to scalability, this is not a public-facing application with hundreds of thousands of daily active users. Access is restricted to authenticated customers managing their own financial data, so the concurrent load will be modest and predictable.

PostgreSQL handles this comfortably — vertical scaling (a larger instance) is sufficient for this use case, and Postgres is well proven at scales far beyond what this application will reach. The horizontal scaling that MongoDB is optimised for is simply not a requirement here, and introducing a document store to solve a problem we do not have would add complexity without benefit.

PostgreSQL is the better choice for this application.

### Note

It might be considered a stretch to use React.js, Express.js and a database for this assessment. But this decision was made with the following statement in mind: *"Treat it as you would a real feature: scope it, make decisions, and build what you think matters most."* Building a pure React.js application without a backend and storing data in localStorage would produce a demoable product, but it would not reflect how this feature would be built in production.


# What next?

## Limitations and improvements

The current solution has a limitation in fully addressing whether repayment options are realistic. At the moment, the customer can get a sense of this through the financial health status and the LLM repayment insight. But it could be made more concrete with suggestions like:

> *"At your current rate, you would clear this debt in around 4 years. If you could find an extra £75 a month, that drops to just under 2 years."*

To achieve this, we would need to capture the total debt owed. This has been scoped out for this exercise to keep things achievable. The next step would be to add a feature that allows customers to log their debts, and then use that data to give more precise repayment projections.

## Making expenditure logging more intelligent

For this exercise, the categorisation of expenditure into essential, discretionary and debt repayment is assumed to be already implemented. In a real-world application, an LLM would be used to classify each expenditure item at the point of logging — before it is saved to the database.

This would introduce an additional layer of complexity, but it would mean a vulnerable customer has the best possible experience without needing to manually categorise every item themselves. The approach would be: use a smaller LLM model to keep costs low, use few-shot prompting with concrete examples embedded in the prompt, and set a low temperature value to make the model more deterministic.


## More tests
At the moment, I have only written tests for the backend. I would also like to add end-to-end tests for the frontend using Playwright or Cypress
In the backend, I still need to add more tests to cover more scenarios especially edge-cases.


## Caching to Improve Performance and Reduce LLM Costs

At the moment, every time the frontend makes an API request to retrieve the dashboard, the LLM analyses the expenditure data to generate suggestions. We can optimise performance and reduce costs by implementing caching.

The LLM should only re-analyse the data when a new financial record is added. If the income and expenditure data have not changed, no additional LLM calls are required.

For example:

- When the client fetches the dashboard, the application first attempts to read the dashboard data, including the LLM-generated suggestions, from the cache.
- If the data exists in the cache, it is returned directly.
- Otherwise, the application queries the database, invokes the LLM to generate suggestions, and stores the result in the cache for future requests.

One potential issue with this approach is stale data. For example, the LLM-generated suggestions may not reflect the latest income and expenditure data immediately after a new financial record is logged.

To address this, we can invalidate or update the cache whenever a new financial record is created.

However, the final caching strategy should be determined based on system metrics such as the read-to-write ratio.

## Further Improvements
There are many other improvements that could be implemented. However, there is only so much that can be achieved within a limited timeframe.

# Bonus Features Implemented
- **Implemented secure statement sharing** via a time-limited link
- **Generated a PDF export** of the statement with appropriate branding