# Draft: Permission Request To OpenRouter

For the "Talk to sales" form on openrouter.ai. Not sent: on 2026-11-18 the owner decided to keep zq on bring-your-own-key instead. Kept for reference.

---

Subject: Permission to offer a metered coding agent built on OpenRouter

Hi OpenRouter team,

I run Zenquanta AI (https://zqai.vercel.app), a consumer AI workspace built on OpenRouter. All of our model traffic goes through one OpenRouter account. Users pay us for plans with token limits, and we pass your model providers' terms on to them.

We are launching zq, a terminal coding agent for our users, on 1 December. zq signs in with a Zenquanta account and sends its model requests to our server. Our server checks the user's plan, limits and allowed models, then forwards the request to OpenRouter under our key. Users never see OpenRouter keys or raw model IDs, and we meter every request against their plan.

Because our server endpoint speaks the OpenAI chat completions format, I want to check this against section 7 of your terms (reselling API access, competing services) before we launch. We are not selling general API access. The endpoint exists so our own app can work, and we do not advertise it for other tools.

Could you confirm whether this use is allowed? If it needs a different agreement or plan, I am happy to set that up. We currently spend through credits on one account and expect that to grow with the launch.

Thanks,
Vanshaj Poonia
Zenquanta AI
