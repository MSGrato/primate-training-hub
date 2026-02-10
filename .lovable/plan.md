

## Add On-the-Job Trainings

Insert 5 new training records into the `trainings` table with category `on_the_job`.

### Trainings to Add

| Title | Frequency | Description |
|-------|-----------|-------------|
| Introduction to the Training Period | one_time | What does your online and on the job training look like at the Primate Center. Go over expectations and timelines. |
| Vacation, Holiday, and Sick Time | one_time | How to request time off, what is our absence/late policy, how do we schedule holidays. |
| Workday | one_time | Entering your timesheet. How to request time off in Workday. How to use Workday and what to use it for. |
| Cage Lock Training | annual | Complete the online cage lock training and demonstrate understanding of where all the locks go for all cage and group housing types. |
| Cagewash | semi_annual | Complete emergency cage wash safety training in person, understand how to properly run the different cycles on a cage washer, and how to prep and run both cages and other equipment. |

### Technical Details

- Use a SQL data insert to add the 5 rows to the `trainings` table with `category = 'on_the_job'`
- The "new hires only" trainings use `frequency = 'one_time'` since they are assigned once during onboarding
- Cage Lock Training uses `frequency = 'annual'`
- Cagewash uses `frequency = 'semi_annual'`
- Note: The "can also be assigned as needed by supervisor" aspect for Cage Lock and Cagewash is a future feature for manual supervisor assignment -- the base frequency is stored as their primary schedule

