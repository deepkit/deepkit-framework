router.get('/user/:id', async (id: number) => {
    return <User user={id}></User>
});
