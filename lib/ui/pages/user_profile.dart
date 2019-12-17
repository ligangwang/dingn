import 'package:dingn/blocs/account/bloc.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class UserProfilePage extends StatefulWidget {

  @override
  _UserProfileState createState() => _UserProfileState();
}

class _UserProfileState extends State<UserProfilePage>
    with SingleTickerProviderStateMixin {
  bool _readOnlyStatus = true;
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AccountBloc, AccountState>(
      builder: (BuildContext context, AccountState state) {
        if(state.account == null)
          return Container();
        return Scaffold(
          body: Container(
            alignment: Alignment.center,
            color: Colors.white,
            child: Column(
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(20),
                  height: 100.0,
                  width: 100.0,
                  color: Colors.white,
                  child: CircleAvatar(
                    backgroundColor: Colors.red,
                    radius: 50.0,
                    backgroundImage: state.account.photoURL == null? null:NetworkImage(state.account.photoURL),
                    child: state.account.photoURL == null? Text(state.account.initials) : null
                  )
                ),
                Container(
                  color: const Color(0xffFFFFFF),
                  alignment: Alignment.bottomCenter,
                  padding: const EdgeInsets.all(20),
                  child:Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Container(
                        height: 60,
                        alignment: Alignment.center,
                        padding: const EdgeInsets.fromLTRB(0, 0, 0, 30),
                        child: const Text(
                          'Display Name:',
                          style: TextStyle(
                              fontSize: 16.0,
                              fontWeight: FontWeight.bold),
                          ),
                      ),
                      const SizedBox(width: 20),
                      Container(
                        height: 60,
                        alignment: Alignment.bottomCenter,
                        constraints: const BoxConstraints(minWidth: 200, maxWidth: 400),
                        child: TextField(
                          controller: TextEditingController(text: state.account.userName),
                          decoration: InputDecoration(
                            hintText: 'Register Your Display Name',
                            errorText: state.errorMessage,
                          ),
                          readOnly: _readOnlyStatus,
                          autofocus: !_readOnlyStatus,
                          onTap: (){
                            if(_readOnlyStatus){
                              setState((){
                                _readOnlyStatus = false;
                              });
                            }
                          },
                          onSubmitted: (newValue){
                            newValue = newValue.trim();
                            BlocProvider.of<AccountBloc>(context).add(ChangeUserNameAccountEvent(userName: newValue));
                          },
                        )
                      )
                    ],
                  )
                ),
              ],
            ),
          )
        );
      }
    );
  }
}