document.getElementById("step1").addEventListener("click",function(){
  const intro = introJs();

  intro.setOptions({
    steps: [
    {
      element: document.getElementById("step1"),
      intro: 'Welcome to our guided tour through the Columbus Blockchain Explorer! Let\'s start...',
      position: 'bottom'
    },
    {
      element: document.getElementById("svg-container"),
      intro: 'Here we have a visualization of the Byzcoin Blockchain. (add a link to the github repo for ex), You can browse through it, by click and dragging. You also can zoom in and out by scrolling up and down. Click on a block and you\'ll be able to check the block details + all the transactions contained in it. The arrows remind us that this is not just a simple blockchain, but a SkipChain ! They allow to traverse short or long distances in a more efficient way.',
      position: 'top'
    },
    {
      element: document.getElementById("step3"),
      intro: 'The search bar can be used to browse for a particular block using its block id or hash. You can also search for an instance by using its ID, the summary of its evolution is loaded when scrolling down on the page.',
      position: 'bottom'
    },
    {
      element: document.getElementById("last-container"),
      intro: 'This part displays the details of the last added blocks, more items will soon be visible here too. The square blockies <img src ="assets/blockie_example.png"/> represent block hashes, click on it to copy it to your clipboard!',
      position: 'left'
    },
    {
      element:document.getElementById("step5"),
      intro:'Here you find the additional details about the selected block. You can see that we use round blockies for user IDs (again click on it to copy the ID). The Forward and Back links are the arrows you cans see on the skipchain, and point to different blocks. By clicking on "Block xxxx" you\'ll be redirected to its details. ',
      position:'top'

    },
    {
      element: document.getElementById("step6"),
      intro: 'In the transaction details, you can witness which instances have been used and browse there past history with the search bar. Instances can be seen as contracts and can be Spawned (created), Invoked (modified), or Deleted, checking it\'s history shows you how the contract has evolved.',
      position: 'top'
    },
    {
      element: document.getElementById("step7"),
      intro: 'Congrats we are done ! Happy exploring :-)',
      position: 'top'
    }

  ] });


  intro.start();

});