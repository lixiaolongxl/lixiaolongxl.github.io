;(function(){
	window.console = window.console || {
		log : function(){}
	};
	
	$we.app = {
		config : {},
		cache : {},
		userTrace : {}
	};
	
	// 对输入组件、叶子节点而言， 需要把自己注册到页面组件中
	$we.app.regForValue = function(data){
		this.notify("itemReg", this, data && data.key);
		if(data.key && $we.app.userTrace[data.key]){
			// 绑定一下用户行为动作
			// TODO
		}
	};
	
	// 集中处理一下类名的问题
	$we.app.dealClass = function(name, pre){
		if(!pre){
			return name;
		}
		if(name.indexOf(pre + ".") == 0){
			return name;
		}
		return pre + "." + name;
	};
	
	// 页面组件或者容器组件， 对汇报上来的值接受
	$we.app.fnItemReg = function(item, key){
		this.itemMap = this.itemMap || {};
		this.itemArr = this.itemArr || [];
		this.itemArr.push(item);
		if(key){
			this.itemMap[key] = item;
		}
	};
	
	// 检查页面中的值是否符合条件
	$we.app.check = function(list){
		if(list){
			for(var i=0;i<list.length;++i){
				if(this.itemMap
						&& this.itemMap[list[i]]
						&& typeof this.itemMap[list[i]].check == "function"
						&& !this.itemMap[list[i]].check()){
					return false;
				}
			}
		}else{
			for(var i=0;this.itemArr && i<this.itemArr.length;++i){
				if(typeof this.itemArr[i].check == "function"
						&& !this.itemArr[i].check()){
					return false;
				}
			}
		}
		return true;
	};
	
	// 获取页面或者容器组件的所有的值
	$we.app.getValue = function(list){
		var ret = {};
		if(list){
			for(var i=0;i<list.length;++i){
				if(this.itemMap
						&& this.itemMap[list[i]]
						&& typeof this.itemMap[list[i]].getValue == "function"){
					ret[list[i]] = this.itemMap[list[i]].getValue();
				}
			}
		}else{
			for(var name in this.itemMap){
				if(typeof this.itemMap[name].getValue == "function"){
					ret[name] = this.itemMap[name].getValue();
				}
			}
		}
		return ret;
	};
	
	var defaultValue = {};
	$we.app.setDefault = function(name, val){
		if($we.type(name) != $we.t.obj){
			defaultValue[name] = val;
		}else{
			for(var n in name){
				$we.app.setDefault(n, name[n]);
			}
		}
	};
	
	$we.app.getDefault = function(name){
		if(name){
			return defaultValue[name];
		}
		return defaultValue;
	};
	
	var globalPageData = {};
	$we.app.set = function(name, val, bForce){
		if(name.match(/^website\./) || bForce){
			globalPageData[name] = val;
		}else{
			globalPageData[name] = globalPageData[name] || {};
			globalPageData[name].value = val;
		}
	};
	
	$we.app.get = function(name){
		if(name.match(/^website\./)){
			return globalPageData[name];	
		}else{
			return $we.json.get(globalPageData, [name, "value"]);
		}
	};
	
	// 页面做中转trigger的动作
	$we.app.fnPageTrigger = function(evt, data){
		return this.notify("trigger", 
			evt, 
			$we.json.get(this, "data.key"), 
			this, 
			data);
	};
	
	// 需要调用页面的接口
	$we.app.trigger = function(){
		if(!arguments[1] || $we.type(arguments[1]) == $we.t.arr){
			// 对页面处理的
			var func = arguments[0],
				param = arguments[1] || [];
			if(typeof this[func] == "function"){
				return this[func].apply(this, param);
			}
			return;
		}
		if(!this.itemMap){
			return;
		}
		var key = arguments[0],
			func = arguments[1],
			param = arguments[2] || [];
		if(this.itemMap[key]){
			if(typeof this.itemMap[key][func] == "function"){
				return this.itemMap[key][func].apply(this.itemMap[key], param);
			}else{
				console.log("no function : [" + func + "]");
			}
		}else{
			console.log("no Item : [" + func + "]");
		}
	};
	
	$we.app.getCalcValue = function(data){
		if($we.type(data) == $we.t.str
			|| $we.type(data) == $we.t.bol
			|| $we.type(data) == $we.t.num){
			return data;
		}
		if($we.type(data) == $we.t.arr){
			var arr = [];
			for(var i=0;i<data.length;++i){
				arr.push($we.app.getCalcValue(data[i]));
			}
			return arr;
		}
		if($we.type(data) == $we.t.obj){
			if(data.param === true && data.value){
				return $we.app.getCalcValue($we.app.get(data.value));
			}
			var ret = {};
			for(name in data){
				ret[name] = $we.app.getCalcValue(data[name]);
			}
			return ret;
		}
		return null;
	};
	
	var procedureConfig = {};
	
	$we.app.setProcedure = function(name, cb){
		procedureConfig[name] = cb;
	};
	
	$we.app.procedure = function(name, opt){
		if(procedureConfig[name]){
			return procedureConfig[name].call(this, opt);
		}
	};
	
	var viewMap = {};
	
	$we.app.initPage = function(parent, data, userVal, cb, scope){
		var pageConfig = data.pageConfig,
			config = data.data,
			name = data.pageConfig,
			me = this;
		if($we.type(data.pageConfig) == $we.t.str){
			pageConfig = this.notify("getPageConfig", data.pageConfig) || this.pageConfig[pageConfig];
		}
		// 设置一下处理的函数
		var initPage = function(){
			pageConfig = $we.app.getCalcValue(pageConfig);
			var page = $we.widget.add({
				name : $we.app.dealClass(pageConfig.type, "manage"),
				notifyTo : this
			}, parent, pageConfig, userVal || data.data);
			this.currPage = page;
			if(pageConfig.key){
				viewMap[pageConfig.key] = page;	
			}
			if($we.app.afterPageChange){
				$we.app.afterPageChange.call(this, name, userVal, pageConfig, data);
			}
			return page;
		};
		// 如果需要在页面切换前做啥事情的话， 处理下
		// $we.app.beforePageChange如果return true的话， 就认为该函数走了回调的方式执行后继的动作
		if($we.app.beforePageChange){
			if(!$we.app.beforePageChange.call(this, name, userVal, pageConfig, data, function(){
					initPage.call(me);
				})){
				return initPage.call(this);
			}
		}else{
			return initPage.call(this);
		}
	};
	
	$we.app.getView = function(name){
		return viewMap[name];
	};
})();