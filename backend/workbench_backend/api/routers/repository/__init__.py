from .repository import git_router, router

router.include_router(git_router)
router = router
