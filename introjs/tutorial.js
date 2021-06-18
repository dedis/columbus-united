document.getElementById("step1").addEventListener("click",function(){
    const intro = introJs();
  
    intro.setOptions({ skipLabel: "Skip", tooltipPosition: "left" });
  
    intro.setOptions({
      steps: [
      {
        element: document.getElementById("step1"),
        intro: 'Welcome to our guided tour through the Columbus Blockchain Explorer! \n You can use the keyboard to naviguate <-> and quit the tour by clicking anywhere on the page. Let\'s start !',
        position: 'bottom'
      },
      {
        element: document.getElementById("svg-container"),
        intro: 'Here we have a visualization of the <a href="https://github.com/dedis/cothority/tree/master/byzcoin" target="_blank">Byzcoin</a> Blockchain. You can browse through it, by click and dragging. You also can zoom in and out by scrolling up and down.',
        position: 'bottom-middle-aligned'
      },
      {
        element: document.getElementById("svg-container"),
        intro: '<b>Click</b> on a block to check the block details + all the transactions contained in it, further down on the page. The arrows remind us that this is not just a simple blockchain, but a <a href="https://github.com/dedis/cothority/tree/master/skipchain" target="_blank">SkipChain</a> ! They allow to traverse short or long distances in a more efficient way.',
        position: 'bottom-right-aligned'
      },
      {
        element: document.getElementById("search-input"),
        intro: 'The search bar can be used to browse for a particular block using its block id or hash. You can also search for an instance by using its ID, the summary of its evolution is loaded when scrolling down on the page.',
        position: 'bottom'
      },
      {
        element: document.getElementById("search-mode"),
        intro: 'You can select different search modes : <i>"Search by xxx"</i> for a block index/hash or instance specific search, <i>"Automatic search"</i> combines all the methods. '
      },
      {
        element: document.getElementById("last-container"),
        intro: 'This part displays the details of the last added blocks, more items will soon be visible here too. The square blockies <img src ="assets/blockie_example.png"/> represent block hashes, click on it to copy it to your clipboard!',
        position: 'left'
      },
      {
        element:document.getElementById("step5"),
        intro:'Here you find the additional details about the selected block. We use <i>round</i> blockies for user IDs (again click on it to copy the ID) <img src="assets/user_Id_blockie.png"/>. The Forward and Back links are the arrows you cans see on the skipchain, and point to different blocks. By clicking on <i>"Block xxxx"</i> you\'ll be redirected to its details. ',
        position:'top'
  
      },
      {
        element: document.getElementById("step6"),
        intro: 'In the transaction details, you can witness which instances have been used and browse there past history with the search bar. Instances can be seen as contracts and can be <i>Spawned</i> (created), <i>Invoked</i> (modified), or <i>Deleted</i>, checking it\'s history shows you how the contract has evolved.',
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
