import unittest

import app


def make_job(**overrides):
    job = {
        "company": "Example",
        "role": "Software Engineer Intern",
        "location": "Chicago, IL",
        "season": "2027",
        "source": "Company Board",
        "summary": "",
        "description": "",
        "sponsorship": "Unknown",
        "tags": ["Internship"],
        "mode": "Hybrid",
    }
    job.update(overrides)
    return job


class JobEligibilityFilterTests(unittest.TestCase):
    def test_opt_and_cpt_require_explicit_posting_language(self):
        jobs = [
            make_job(company="OPT Co", description="Candidates using OPT are welcome to apply."),
            make_job(company="CPT Co", description="Must be eligible for curricular practical training (CPT)."),
            make_job(company="Unknown Co"),
        ]

        opt_results = app.filter_jobs(jobs, {"eligibility": "opt"})
        cpt_results = app.filter_jobs(jobs, {"eligibility": "cpt"})

        self.assertEqual([job["company"] for job in opt_results], ["OPT Co"])
        self.assertEqual([job["company"] for job in cpt_results], ["CPT Co"])

    def test_f1_review_queue_excludes_known_restrictions(self):
        jobs = [
            make_job(company="F1 Co", summary="Open to F-1 international students."),
            make_job(company="OPT Co", description="OPT accepted."),
            make_job(company="CPT Co", description="CPT accepted."),
            make_job(company="Unknown Co"),
            make_job(company="Citizen Co", description="U.S. citizenship required."),
            make_job(company="No Sponsor Co", description="Unable to sponsor work visas."),
        ]

        results = app.filter_jobs(jobs, {"eligibility": "f1"})

        self.assertEqual([job["company"] for job in results], ["F1 Co", "OPT Co", "CPT Co", "Unknown Co"])

    def test_sponsorship_filter_does_not_include_negative_language(self):
        jobs = [
            make_job(company="Sponsor Co", sponsorship="Visa sponsorship available"),
            make_job(company="Blocked Co", description="We are unable to sponsor work visas."),
        ]

        sponsored = app.filter_jobs(jobs, {"eligibility": "sponsorship"})
        blocked = app.filter_jobs(jobs, {"eligibility": "no-sponsorship"})

        self.assertEqual([job["company"] for job in sponsored], ["Sponsor Co"])
        self.assertEqual([job["company"] for job in blocked], ["Blocked Co"])


if __name__ == "__main__":
    unittest.main()
