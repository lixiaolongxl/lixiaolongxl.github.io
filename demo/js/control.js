;(function(){
	var init = function(parent){
		var type = $we.str.getUrlParam(window.location.href, "type");
		if($.inArray(type, ["detail"]) == -1){
			type = "index";
		}
		var body = document.getElementById("body");
		switch(type){
			case "detail":
				loadDetail.call(this, type, body);
				break;
			default:
				loadIndex.call(this, type, body);
				break;
		}
	};
	
	var loadIndex = function(type, body){
		this.body = $we.widget.add({
			name : "pic.page",
			notifyTo : this
		}, body);
		$("html").addClass("white-bg");
	};
	
	var loadDetail = function(type, body){
		this.body = $we.widget.add({
			name : "pic.detail",
			notifyTo : this
		}, body);
		
	};
	
	$we.widget.reg("pic.control", {
		init : init
	});
	
	$we.pageInstanse = $we.widget.add("pic.control");
})();