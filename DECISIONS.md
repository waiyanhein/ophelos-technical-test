# Problems
- "no reflection of their financial position"
- "no sense of whether their repayment options are realistic"
- "no way to track whether things are getting better or worse over time."

# Requirements
## Must
- Calculate and display a meaningful affordability assessment to the customer
- Allow customers to track their financial position over time
- Be well tested. Tests should protect something real, not just assert happy paths

# Pages
- Due to the limited time I've got, I would build a simple dashboard page as all the requirements can be implmented and re-represented 
TODO


# Product Features
## The Affordability Assessment
Given that we have the customer's income and expenditure data, we can easily calculate Disposable Income, which is the first number they need to understand their financial position.



## Login

## Financial Health Status Widget

## Monthly Spending Widget

- Provides a breakdown of income and outgoings, while categorising outgoings into three groups:
  - Essential Bills
  - Debt Repayments
  - Discretionary Spending

- This widget gives customers a clear visual overview of how they are spending their money.

- It highlights what portion of their income is being used for debt repayments.

- The widget also suggests ways customers can adjust their discretionary spending and improve their spending habits to help repay debt earlier.
  - For example, it may suggest cancelling one of the streaming subscriptions if the customer has subscriptions to Netflix, Disney+, and Amazon Prime.

## Progress Over Time Widget

- Tracks the customer’s financial progress over time and provides a clear view of improvements across a 6-month period.


# Tech Stack
### Front-end and Back-end frameworks
- **First choice: Pure React.js (frontend only)**  
  - **Issue:** While this approach is pragmatic for the assessment, it treats the exercise more like a coding test rather than a real-world project.  
  - For example, storing data in `localStorage` and performing calculations on the client side is generally considered poor practice from both a security and data confidentiality perspective.

- **Second choice: Next.js without a dedicated backend API server (e.g. Express.js)**  
  - **Issue:** SEO is not a requirement for this application.  
  - Using Next.js would introduce unnecessary server-side rendering overhead and potentially higher hosting costs without providing significant benefits for this use case.

- **Final decision: React.js (SPA) + Dedicated API**
  - Evaluated:
    - **Serverless API**
    - **Serverful API (Express.js)**
  - In a real-world production environment, a serverless API would likely be more suitable for this application. However, it would make local development and testing more difficult.

### Database
- SQL vs NoSQL -> SQL

We are storing financial data belonging to vulnerable customers in an 
FCA-regulated environment. ACID compliance is essential — saving a 
snapshot and its associated line items must be atomic, so the database 
is never left in a partially valid state.

Data integrity is equally important. Income and expenditure items should 
not exist without a parent snapshot. The foreign key and primary key 
constraints that come with a relational database enforce this at the 
database level, not just in application code — which is the right place 
for that guarantee in a regulated context.

When it comes to scalability, this is not a public-facing application 
with hundreds of thousands of daily active users. Access is restricted 
to authenticated customers managing their own financial data, so the 
concurrent load will be modest and predictable.

PostgreSQL handles this comfortably — vertical scaling (a larger 
instance) is sufficient for this use case, and Postgres is well proven 
at scales far beyond what this application will reach. The horizontal 
scaling that MongoDB is optimised for is simply not a requirement here, 
and introducing a document store to solve a problem we don't have would 
add complexity without benefit.